--[[
    Roblox WebSocket Client for Anti-Exploit System
    Simple version without signature verification
    
    This script connects to the WebSocket server, sends validation requests,
    and maintains a heartbeat connection.
]]

-- Configuration
local CONFIG = {
    -- WebSocket server URL (change to your actual server URL in production)
    SERVER_URL = "ws://localhost:3000",
    
    -- Validation parameters
    SERVICE_ID = "pandadevkit",
    HWID = "2062f80093066633876b542212c496501a5e79523cc4ea9b28667dff065afd8f",
    CLIENT_KEY = "your_client_key_here",
    
    -- Heartbeat interval in seconds
    HEARTBEAT_INTERVAL = 25
}

-- WebSocket connection
local ws = nil

-- Heartbeat timer
local heartbeatTimer = nil

-- Services
local HttpService = game:GetService("HttpService")

-- Utility functions for colored console output
local function printSuccess(message)
    print("\27[32m[SUCCESS]\27[0m " .. message)
end

local function printError(message)
    print("\27[31m[ERROR]\27[0m " .. message)
end

local function printInfo(message)
    print("\27[36m[INFO]\27[0m " .. message)
end

local function printWarning(message)
    print("\27[33m[WARNING]\27[0m " .. message)
end

-- Send heartbeat to server
local function sendHeartbeat()
    if not ws then return end
    
    -- Create heartbeat message
    local heartbeatMessage = {
        type = "heartbeat",
        timestamp = os.time() * 1000 -- Convert to milliseconds
    }
    
    -- Send heartbeat
    ws:Send(HttpService:JSONEncode(heartbeatMessage))
    
    printInfo("Sent heartbeat to server")
end

-- Send validation request to server
local function sendValidationRequest()
    if not ws then
        printError("Not connected to WebSocket server")
        return
    end
    
    -- Create validation request
    local validationRequest = {
        type = "validate",
        serviceId = CONFIG.SERVICE_ID,
        hwid = CONFIG.HWID,
        key = CONFIG.CLIENT_KEY
    }
    
    -- Send validation request
    ws:Send(HttpService:JSONEncode(validationRequest))
    
    printInfo("Sent validation request")
end

-- Connect to WebSocket server
local function connectToServer()
    -- Build WebSocket URL with query parameters
    local url = CONFIG.SERVER_URL .. 
                "/?serviceId=" .. CONFIG.SERVICE_ID .. 
                "&hwid=" .. CONFIG.HWID .. 
                "&key=" .. CONFIG.CLIENT_KEY
    
    printInfo("Connecting to " .. url)
    
    -- Create WebSocket connection
    ws = WebSocket.connect(url)
    
    -- Set up event handlers
    ws.OnMessage:Connect(function(message)
        -- Parse message
        local success, data = pcall(function()
            return HttpService:JSONDecode(message)
        end)
        
        if not success then
            printError("Failed to parse message: " .. message)
            return
        end
        
        printInfo("Received message: " .. message)
        
        -- Handle specific message types
        if data.type == "welcome" then
            printSuccess("Connected to WebSocket server (Client ID: " .. data.clientId .. ")")
            
            -- Start heartbeat timer
            if heartbeatTimer then
                heartbeatTimer:Disconnect()
            end
            
            heartbeatTimer = task.spawn(function()
                while true do
                    task.wait(CONFIG.HEARTBEAT_INTERVAL)
                    sendHeartbeat()
                end
            end)
            
        elseif data.type == "validation_response" then
            if data.success then
                printSuccess("Validation successful: " .. (data.message or ""))
                
                -- Store validation data if needed
                local validationData = data.data
                
                -- You can use this data to enable/disable features in your game
                if validationData and validationData.Key_Information then
                    local keyInfo = validationData.Key_Information
                    
                    -- Example: Check if premium mode is enabled
                    if keyInfo.Premium_Mode then
                        printSuccess("Premium features enabled")
                        -- Enable premium features in your game
                    end
                    
                    -- Example: Check expiration date
                    if keyInfo.expiresAt and keyInfo.expiresAt ~= "N/A" then
                        printInfo("Key expires at: " .. keyInfo.expiresAt)
                    end
                end
                
            else
                printError("Validation failed: " .. (data.message or ""))
                
                -- Handle failed validation (e.g., kick player, disable features)
                -- Example: game.Players.LocalPlayer:Kick("Authentication failed")
            end
            
        elseif data.type == "heartbeat_response" then
            printInfo("Received heartbeat response")
            
        elseif data.type == "error" then
            printError("Error from server: " .. (data.message or "Unknown error"))
        end
    end)
    
    ws.OnClose:Connect(function()
        printWarning("Disconnected from WebSocket server")
        
        -- Clean up
        if heartbeatTimer then
            heartbeatTimer:Disconnect()
            heartbeatTimer = nil
        end
        
        ws = nil
        
        -- Optional: Try to reconnect after a delay
        -- task.delay(5, connectToServer)
    end)
    
    ws.OnError:Connect(function(error)
        printError("WebSocket error: " .. tostring(error))
    end)
end

-- Create a simple UI for testing in Roblox
local function createTestUI()
    -- Check if we're in a GUI environment
    if not game or not game:GetService("Players") or not game:GetService("Players").LocalPlayer then
        printWarning("Not in a GUI environment, skipping UI creation")
        return
    end
    
    -- Create ScreenGui
    local screenGui = Instance.new("ScreenGui")
    screenGui.Name = "WebSocketTestUI"
    screenGui.Parent = game:GetService("Players").LocalPlayer:WaitForChild("PlayerGui")
    
    -- Create frame
    local frame = Instance.new("Frame")
    frame.Size = UDim2.new(0, 300, 0, 200)
    frame.Position = UDim2.new(0.5, -150, 0.5, -100)
    frame.BackgroundColor3 = Color3.fromRGB(40, 40, 40)
    frame.BorderSizePixel = 0
    frame.Parent = screenGui
    
    -- Create title
    local title = Instance.new("TextLabel")
    title.Size = UDim2.new(1, 0, 0, 30)
    title.Position = UDim2.new(0, 0, 0, 0)
    title.BackgroundColor3 = Color3.fromRGB(60, 60, 60)
    title.TextColor3 = Color3.fromRGB(255, 255, 255)
    title.Text = "WebSocket Test"
    title.TextSize = 18
    title.Font = Enum.Font.SourceSansBold
    title.Parent = frame
    
    -- Create connect button
    local connectButton = Instance.new("TextButton")
    connectButton.Size = UDim2.new(0.8, 0, 0, 30)
    connectButton.Position = UDim2.new(0.1, 0, 0.2, 0)
    connectButton.BackgroundColor3 = Color3.fromRGB(0, 120, 215)
    connectButton.TextColor3 = Color3.fromRGB(255, 255, 255)
    connectButton.Text = "Connect"
    connectButton.TextSize = 16
    connectButton.Font = Enum.Font.SourceSans
    connectButton.Parent = frame
    
    -- Create validate button
    local validateButton = Instance.new("TextButton")
    validateButton.Size = UDim2.new(0.8, 0, 0, 30)
    validateButton.Position = UDim2.new(0.1, 0, 0.4, 0)
    validateButton.BackgroundColor3 = Color3.fromRGB(0, 120, 215)
    validateButton.TextColor3 = Color3.fromRGB(255, 255, 255)
    validateButton.Text = "Validate"
    validateButton.TextSize = 16
    validateButton.Font = Enum.Font.SourceSans
    validateButton.Enabled = false
    validateButton.Parent = frame
    
    -- Create status label
    local statusLabel = Instance.new("TextLabel")
    statusLabel.Size = UDim2.new(0.8, 0, 0, 30)
    statusLabel.Position = UDim2.new(0.1, 0, 0.8, 0)
    statusLabel.BackgroundTransparency = 1
    statusLabel.TextColor3 = Color3.fromRGB(255, 255, 255)
    statusLabel.Text = "Disconnected"
    statusLabel.TextSize = 14
    statusLabel.Font = Enum.Font.SourceSans
    statusLabel.Parent = frame
    
    -- Connect button click handler
    connectButton.MouseButton1Click:Connect(function()
        statusLabel.Text = "Connecting..."
        connectToServer()
        validateButton.Enabled = true
        statusLabel.Text = "Connected"
    end)
    
    -- Validate button click handler
    validateButton.MouseButton1Click:Connect(function()
        statusLabel.Text = "Validating..."
        sendValidationRequest()
    end)
end

-- Main function
local function main()
    printInfo("Roblox WebSocket Client")
    printInfo("======================")
    
    -- Check if WebSocket is available
    if not WebSocket then
        printError("WebSocket library not available. Make sure you're using an executor that supports WebSockets.")
        return
    end
    
    -- Create test UI if in a GUI environment
    createTestUI()
    
    -- If not in a GUI environment, connect automatically
    if not game or not game:GetService("Players") or not game:GetService("Players").LocalPlayer then
        printInfo("Automatically connecting to server...")
        connectToServer()
        
        -- Wait a bit and then send validation request
        task.wait(2)
        sendValidationRequest()
    end
    
    -- Return API for script usage
    return {
        connect = connectToServer,
        validate = sendValidationRequest,
        disconnect = function()
            if ws then
                ws:Close()
            end
        end
    }
end

-- Run the main function
return main()
