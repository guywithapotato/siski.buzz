-- A deliberately tiny, single-message wire protocol.
-- Lengths are byte lengths, so UTF-8 is transported without alteration.

local Protocol = {
    MAX_ALIAS_BYTES = 64,
    MAX_MESSAGE_BYTES = 16 * 1024,
}

local MAGIC = "KCHAT/1\n"
local MAX_HEADER_BYTES = 64

function Protocol.encode(message, sender_alias)
    assert(type(message) == "string", "message must be a string")
    sender_alias = sender_alias or ""
    assert(type(sender_alias) == "string", "sender alias must be a string")
    assert(#sender_alias <= Protocol.MAX_ALIAS_BYTES, "sender alias is too large")
    assert(#message <= Protocol.MAX_MESSAGE_BYTES, "message is too large")
    return MAGIC .. "MSG " .. #sender_alias .. " " .. #message .. "\n" .. sender_alias .. message
end

-- Returns one of:
--   message, nil, remaining_bytes, sender_alias
--   nil, "incomplete"
--   nil, human_readable_error
function Protocol.decode(buffer)
    if type(buffer) ~= "string" then
        return nil, "invalid buffer"
    end

    if #buffer < #MAGIC then
        if MAGIC:sub(1, #buffer) == buffer then
            return nil, "incomplete"
        end
        return nil, "invalid protocol signature"
    end

    if buffer:sub(1, #MAGIC) ~= MAGIC then
        return nil, "invalid protocol signature"
    end

    local header_end = buffer:find("\n", #MAGIC + 1, true)
    if not header_end then
        if #buffer > #MAGIC + MAX_HEADER_BYTES then
            return nil, "header is too long"
        end
        return nil, "incomplete"
    end

    local header = buffer:sub(#MAGIC + 1, header_end - 1)
    local alias_length_text, message_length_text = header:match("^MSG (%d+) (%d+)$")
    if not alias_length_text then
        -- Read frames from the first prototype build, which had no alias.
        message_length_text = header:match("^MSG (%d+)$")
        alias_length_text = message_length_text and "0" or nil
    end
    if not alias_length_text or not message_length_text then
        return nil, "invalid message header"
    end

    local alias_length = tonumber(alias_length_text)
    local message_length = tonumber(message_length_text)
    if not alias_length or alias_length > Protocol.MAX_ALIAS_BYTES then
        return nil, "sender alias is too large"
    end
    if not message_length or message_length > Protocol.MAX_MESSAGE_BYTES then
        return nil, "message is too large"
    end

    local payload_start = header_end + 1
    local alias_end = payload_start + alias_length - 1
    local message_start = alias_end + 1
    local payload_end = message_start + message_length - 1
    if #buffer < payload_end then
        return nil, "incomplete"
    end

    local sender_alias = buffer:sub(payload_start, alias_end)
    local message = buffer:sub(message_start, payload_end)
    return message, nil, buffer:sub(payload_end + 1), sender_alias
end

return Protocol
