local DataStorage = require("datastorage")
local InfoMessage = require("ui/widget/infomessage")
local InputDialog = require("ui/widget/inputdialog")
local LuaSettings = require("luasettings")
local MultiInputDialog = require("ui/widget/multiinputdialog")
local Notification = require("ui/widget/notification")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local logger = require("logger")
local socket = require("socket")
local _ = require("gettext")
local T = require("ffi/util").template

local Protocol = require("kchat_protocol")

local DEFAULT_PORT = 57321
local POLL_INTERVAL_SECONDS = 0.20
local CLIENT_IDLE_TIMEOUT_SECONDS = 10
local CONNECT_TIMEOUT_SECONDS = 5
local MAX_LOG_ENTRIES = 100

local KChat = WidgetContainer:extend{
    name = "kchat",
    fullname = _("KChat"),
    is_doc_only = false,
}

local function trim(value)
    return (value:gsub("^%s+", ""):gsub("%s+$", ""))
end

local function isValidIPv4(address)
    if type(address) ~= "string" or address == "" then
        return false
    end

    local count = 0
    for octet in address:gmatch("([^.]+)") do
        count = count + 1
        if count > 4 or not octet:match("^%d+$") then
            return false
        end
        local value = tonumber(octet)
        if not value or value < 0 or value > 255 then
            return false
        end
    end
    return count == 4 and not address:match("^%.") and not address:match("%.$")
end

local function isValidPort(port)
    return port and port == math.floor(port) and port >= 1024 and port <= 65535
end

local function isValidAlias(alias)
    return type(alias) == "string"
        and #alias <= Protocol.MAX_ALIAS_BYTES
        and not alias:find("[\r\n]")
end

function KChat:init()
    self.settings = LuaSettings:open(DataStorage:getSettingsDir() .. "/kchat.lua")
    self.peer_ip = self.settings:readSetting("peer_ip", "")
    self.local_alias = self.settings:readSetting("local_alias", "Kobo")
    self.peer_alias = self.settings:readSetting("peer_alias", "")
    if not isValidAlias(self.local_alias) or trim(self.local_alias) == "" then
        self.local_alias = "Kobo"
    end
    if not isValidAlias(self.peer_alias) then
        self.peer_alias = ""
    end
    self.port = tonumber(self.settings:readSetting("port", DEFAULT_PORT)) or DEFAULT_PORT
    if not isValidPort(self.port) then
        self.port = DEFAULT_PORT
    end

    -- These must be instance fields: KOReader creates fresh plugin instances when
    -- moving between the file manager and reader.
    self.listener = nil
    self.clients = {}
    self.log_entries = {}
    self.log_dialog = nil
    self.resume_listener = false
    self.poll_task = function()
        self:_pollSafely()
    end

    self:_appendLog(_("KChat is ready. Start the listener on the receiving Kobo."))
    if self.ui and self.ui.menu then
        self.ui.menu:registerToMainMenu(self)
    end
end

function KChat:addToMainMenu(menu_items)
    menu_items.kchat = {
        text = self.fullname,
        sorting_hint = "tools",
        sub_item_table_func = function()
            return self:_menuItems()
        end,
    }
end

function KChat:_menuItems()
    return {
        {
            text = _("Open chat log"),
            callback = function()
                self:showLog()
            end,
        },
        {
            text = _("Send a message"),
            callback = function()
                self:showSendDialog()
            end,
        },
        {
            text_func = function()
                if self.listener then
                    return T(_("Stop listener (port %1)"), self.port)
                end
                return T(_("Start listener (port %1)"), self.port)
            end,
            keep_menu_open = true,
            callback = function(touchmenu_instance)
                if self.listener then
                    self:stopListener()
                    UIManager:show(InfoMessage:new{
                        text = _("KChat listener stopped."),
                        timeout = 2,
                    })
                else
                    local ok, err = self:startListener()
                    if ok then
                        UIManager:show(InfoMessage:new{
                            text = T(_("Listening for KChat messages on port %1."), self.port),
                            timeout = 3,
                        })
                    else
                        UIManager:show(InfoMessage:new{
                            text = T(_("Could not start the KChat listener:\n%1"), err),
                        })
                    end
                end
                if touchmenu_instance then
                    touchmenu_instance:updateItems()
                end
            end,
        },
        {
            text_func = function()
                local peer = self.peer_ip ~= "" and self.peer_ip or _("not set")
                if self.peer_alias ~= "" then
                    peer = T(_("%1 (%2)"), self.peer_alias, peer)
                end
                return T(_("Peer: %1:%2"), peer, self.port)
            end,
            callback = function(touchmenu_instance)
                self:showSettingsDialog(touchmenu_instance)
            end,
        },
        {
            text = _("About KChat"),
            keep_menu_open = true,
            callback = function()
                UIManager:show(InfoMessage:new{
                    text = _([[KChat sends one UTF-8 message per direct TCP connection on your local Wi-Fi network.

This prototype has no encryption, authentication, discovery, cloud service, or saved history. Anyone who can reach the listening port can send a message.]]),
                })
            end,
        },
    }
end

function KChat:showSettingsDialog(touchmenu_instance)
    local dialog
    dialog = MultiInputDialog:new{
        title = _("KChat connection settings"),
        fields = {
            {
                description = _("My alias (sent with messages)"),
                text = self.local_alias,
                hint = _("Kobo"),
            },
            {
                description = _("Peer alias (optional local override)"),
                text = self.peer_alias,
                hint = _("Other Kobo"),
            },
            {
                description = _("Other Kobo's IPv4 address"),
                text = self.peer_ip,
                hint = "192.168.1.42",
            },
            {
                description = _("TCP port (same on both Kobos)"),
                input_type = "number",
                text = tostring(self.port),
                hint = tostring(DEFAULT_PORT),
            },
        },
        buttons = {
            {
                {
                    text = _("Cancel"),
                    id = "close",
                    callback = function()
                        UIManager:close(dialog)
                    end,
                },
                {
                    text = _("Save"),
                    is_enter_default = true,
                    callback = function()
                        local fields = dialog:getFields()
                        local local_alias = trim(fields[1] or "")
                        local peer_alias = trim(fields[2] or "")
                        local peer_ip = trim(fields[3] or "")
                        local port = tonumber(fields[4])
                        if local_alias == "" or not isValidAlias(local_alias) then
                            UIManager:show(InfoMessage:new{
                                text = T(_("Enter a name up to %1 bytes without line breaks."), Protocol.MAX_ALIAS_BYTES),
                            })
                            return
                        end
                        if not isValidAlias(peer_alias) then
                            UIManager:show(InfoMessage:new{
                                text = T(_("Peer alias must be at most %1 bytes without line breaks."), Protocol.MAX_ALIAS_BYTES),
                            })
                            return
                        end
                        if peer_ip ~= "" and not isValidIPv4(peer_ip) then
                            UIManager:show(InfoMessage:new{
                                text = _("Enter a valid IPv4 address, for example 192.168.1.42."),
                            })
                            return
                        end
                        if not isValidPort(port) then
                            UIManager:show(InfoMessage:new{
                                text = _("Enter a port from 1024 through 65535."),
                            })
                            return
                        end

                        local restart_listener = self.listener ~= nil and port ~= self.port
                        if restart_listener then
                            self:stopListener(true)
                        end

                        self.peer_ip = peer_ip
                        self.port = port
                        self.local_alias = local_alias
                        self.peer_alias = peer_alias
                        self.settings:saveSetting("peer_ip", self.peer_ip)
                        self.settings:saveSetting("port", self.port)
                        self.settings:saveSetting("local_alias", self.local_alias)
                        self.settings:saveSetting("peer_alias", self.peer_alias)
                        self.settings:flush()
                        UIManager:close(dialog)

                        if restart_listener then
                            local ok, err = self:startListener()
                            if not ok then
                                UIManager:show(InfoMessage:new{
                                    text = T(_("Settings saved, but the listener could not restart:\n%1"), err),
                                })
                            end
                        end
                        if touchmenu_instance then
                            touchmenu_instance:updateItems()
                        end
                    end,
                },
            },
        },
    }
    UIManager:show(dialog)
    dialog:onShowKeyboard()
end

function KChat:showSendDialog()
    if not isValidIPv4(self.peer_ip) then
        UIManager:show(InfoMessage:new{
            text = _("Set the other Kobo's IPv4 address first."),
        })
        return
    end

    local dialog
    dialog = InputDialog:new{
        title = T(_("Send to %1"), self:_peerLabel(self.peer_ip)),
        input = "",
        input_hint = _("Type a message"),
        allow_newline = true,
        fullscreen = true,
        condensed = true,
        cursor_at_end = true,
        buttons = {
            {
                {
                    text = _("Cancel"),
                    id = "close",
                    callback = function()
                        UIManager:close(dialog)
                    end,
                },
                {
                    text = _("Send"),
                    callback = function()
                        local message = dialog:getInputText()
                        if message == "" then
                            UIManager:show(InfoMessage:new{
                                text = _("Type a message first."),
                                timeout = 2,
                            })
                            return
                        end
                        if #message > Protocol.MAX_MESSAGE_BYTES then
                            UIManager:show(InfoMessage:new{
                                text = T(_("Message is too large. The limit is %1 bytes."), Protocol.MAX_MESSAGE_BYTES),
                            })
                            return
                        end

                        UIManager:close(dialog)
                        -- Let the close repaint happen before the short blocking connect.
                        UIManager:nextTick(function()
                            local ok, err = self:sendMessage(message)
                            if ok then
                                UIManager:show(InfoMessage:new{
                                    text = _("KChat message sent."),
                                    timeout = 2,
                                })
                            else
                                UIManager:show(InfoMessage:new{
                                    text = T(_("KChat could not send the message:\n%1"), err),
                                })
                            end
                        end)
                    end,
                },
            },
        },
    }
    UIManager:show(dialog)
    dialog:onShowKeyboard()
end

function KChat:showLog()
    if self.log_dialog and UIManager:isWidgetShown(self.log_dialog) then
        return
    end

    local dialog
    dialog = InputDialog:new{
        title = T(_("Chat with %1"), self:_peerLabel(self.peer_ip)),
        input = self:_logText(),
        readonly = true,
        allow_newline = true,
        fullscreen = true,
        condensed = true,
        add_nav_bar = true,
        cursor_at_end = false,
        buttons = {
            {
                {
                    text = _("Close"),
                    id = "close",
                    callback = function()
                        UIManager:close(dialog)
                        self.log_dialog = nil
                    end,
                },
                {
                    text = _("Clear"),
                    callback = function()
                        self.log_entries = {}
                        self:_appendLog(_("Log cleared."))
                    end,
                },
                {
                    text = _("Send"),
                    callback = function()
                        self:showSendDialog()
                    end,
                },
            },
        },
    }
    self.log_dialog = dialog
    UIManager:show(dialog)
end

function KChat:_appendLog(text)
    table.insert(self.log_entries, os.date("%H:%M:%S") .. "  " .. text)
    while #self.log_entries > MAX_LOG_ENTRIES do
        table.remove(self.log_entries, 1)
    end

    if self.log_dialog and UIManager:isWidgetShown(self.log_dialog) then
        self.log_dialog:setInputText(self:_logText(), false, false)
        UIManager:setDirty(self.log_dialog, "ui")
    end
end

function KChat:_logText()
    return table.concat(self.log_entries, "\n\n")
end

function KChat:_localLabel()
    return T(_("You (%1)"), self.local_alias)
end

function KChat:_peerLabel(peer_ip, transmitted_alias)
    peer_ip = peer_ip or self.peer_ip
    local alias
    if peer_ip == self.peer_ip and self.peer_alias ~= "" then
        alias = self.peer_alias
    elseif transmitted_alias and transmitted_alias ~= "" then
        alias = transmitted_alias
    else
        alias = _("Other Kobo")
    end
    if peer_ip and peer_ip ~= "" then
        return T(_("%1 (%2)"), alias, peer_ip)
    end
    return alias
end

function KChat:startListener()
    if self.listener then
        return true
    end

    -- LuaSocket's bind helper explicitly maps "*" to 0.0.0.0. Creating a raw
    -- tcp() socket and binding it to "*" can select IPv6 on some builds, which
    -- would reject the manually configured IPv4 peers used by this prototype.
    local listener, err = socket.bind("*", self.port, 4)
    if not listener then
        return nil, err or _("could not bind the TCP port")
    end
    listener:settimeout(0)

    self.listener = listener
    self.clients = {}
    self:_appendLog(T(_("Listener started on port %1."), self.port))
    UIManager:unschedule(self.poll_task)
    UIManager:nextTick(self.poll_task)
    return true
end

function KChat:stopListener(quiet)
    UIManager:unschedule(self.poll_task)
    for _, client_state in ipairs(self.clients) do
        client_state.socket:close()
    end
    self.clients = {}
    if self.listener then
        self.listener:close()
        self.listener = nil
        if not quiet then
            self:_appendLog(_("Listener stopped."))
        end
    end
end

function KChat:_pollSafely()
    if not self.listener then
        return
    end

    local ok, err = pcall(function()
        self:_pollOnce()
    end)
    if not ok then
        logger.warn("KChat listener error:", err)
        self:_appendLog(T(_("Listener error: %1"), tostring(err)))
        self:stopListener(true)
        UIManager:show(InfoMessage:new{
            text = T(_("The KChat listener stopped after an error:\n%1"), tostring(err)),
        })
        return
    end

    if self.listener then
        UIManager:scheduleIn(POLL_INTERVAL_SECONDS, self.poll_task)
    end
end

function KChat:_pollOnce()
    -- Drain a bounded number of waiting connections per tick.
    for _ = 1, 8 do
        local client = self.listener:accept()
        if not client then
            break
        end
        client:settimeout(0)
        local peer_ip = client:getpeername()
        table.insert(self.clients, {
            socket = client,
            peer_ip = peer_ip or _("unknown peer"),
            buffer = "",
            accepted_at = socket.gettime(),
        })
    end

    local now = socket.gettime()
    for index = #self.clients, 1, -1 do
        local state = self.clients[index]
        local data, receive_error, partial = state.socket:receive(4096)
        local chunk = data or partial
        if chunk and #chunk > 0 then
            state.buffer = state.buffer .. chunk
        end

        local message, protocol_error, rest, sender_alias = Protocol.decode(state.buffer) -- luacheck: ignore 211
        if message then
            local peer_label = self:_peerLabel(state.peer_ip, sender_alias)
            self:_appendLog(T(_("%1:\n%2"), peer_label, message))
            UIManager:show(Notification:new{
                text = T(_("New KChat message from %1"), peer_label),
                timeout = 3,
            })
            self:_removeClient(index)
        elseif protocol_error ~= "incomplete" then
            self:_appendLog(T(_("Rejected data from %1: %2"), state.peer_ip, protocol_error))
            self:_removeClient(index)
        elseif receive_error == "closed" then
            self:_appendLog(T(_("Incomplete message from %1."), state.peer_ip))
            self:_removeClient(index)
        elseif now - state.accepted_at > CLIENT_IDLE_TIMEOUT_SECONDS then
            self:_appendLog(T(_("Timed out waiting for a message from %1."), state.peer_ip))
            self:_removeClient(index)
        end
    end
end

function KChat:_removeClient(index)
    local state = self.clients[index]
    if state then
        state.socket:close()
        table.remove(self.clients, index)
    end
end

local function sendAll(client, bytes)
    local next_byte = 1
    while next_byte <= #bytes do
        local sent_through, err, partial_through = client:send(bytes, next_byte)
        if sent_through then
            next_byte = sent_through + 1
        elseif partial_through and partial_through >= next_byte then
            next_byte = partial_through + 1
            if err then
                return nil, err
            end
        else
            return nil, err or _("socket send failed")
        end
    end
    return true
end

function KChat:sendMessage(message)
    local client, err = socket.tcp()
    if not client then
        return nil, err or _("could not create a TCP socket")
    end
    client:settimeout(CONNECT_TIMEOUT_SECONDS)
    client:setoption("tcp-nodelay", true)

    local ok
    ok, err = client:connect(self.peer_ip, self.port)
    if not ok then
        client:close()
        return nil, err or _("connection failed")
    end

    local frame = Protocol.encode(message, self.local_alias)
    ok, err = sendAll(client, frame)
    if ok then
        client:shutdown("send")
    end
    client:close()
    if not ok then
        return nil, err or _("send failed")
    end

    self:_appendLog(T(_("%1:\n%2"), self:_localLabel(), message))
    return true
end

function KChat:onSuspend()
    self.resume_listener = self.listener ~= nil
    if self.resume_listener then
        self:stopListener(true)
    end
end

function KChat:onResume()
    if self.resume_listener then
        self.resume_listener = false
        local ok, err = self:startListener()
        if not ok then
            self:_appendLog(T(_("Could not restart listener after resume: %1"), err))
        end
    end
end

function KChat:_shutdown()
    self.resume_listener = false
    self:stopListener(true)
end

function KChat:onCloseWidget()
    self:_shutdown()
end

function KChat:onExit()
    self:_shutdown()
end

return KChat
