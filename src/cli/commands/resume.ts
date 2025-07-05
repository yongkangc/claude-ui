import { EventSource } from 'eventsource';
import { createLogger } from '../../services/logger';

interface ResumeOptions {
  serverPort?: string;
  json?: boolean;
  debug?: boolean;
}

interface ResumeResponse {
  streamingId: string;
  streamUrl: string;
}

export async function resumeCommand(sessionId: string, message: string, options: ResumeOptions): Promise<void> {
  // Note: Debug mode for logger should be configured in config.json
  // The debug option here is for verbose output only
  
  const logger = createLogger('ResumeCommand');
  const serverPort = options.serverPort || '3001';
  const baseUrl = `http://localhost:${serverPort}`;
  
  logger.debug('Resume command started', {
    sessionId,
    messagePreview: message.substring(0, 50) + (message.length > 50 ? '...' : ''),
    serverPort,
    json: options.json,
    debug: options.debug
  });
  
  if (options.debug && !options.json) {
    console.log(`🐛 Debug mode enabled`);
    console.log(`🔗 Connecting to: ${baseUrl}`);
  }

  try {
    // 1. Start resume conversation
    if (!options.json) {
      console.log(`Resuming conversation ${sessionId}...`);
    }
    
    const resumeResponse = await fetch(`${baseUrl}/api/conversations/resume`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sessionId,
        message
      })
    });

    if (!resumeResponse.ok) {
      const errorText = await resumeResponse.text();
      logger.error('Resume request failed', undefined, {
        status: resumeResponse.status,
        statusText: resumeResponse.statusText,
        errorText
      });
      
      console.error(`Failed to resume conversation: ${resumeResponse.status} ${resumeResponse.statusText}`);
      if (errorText) {
        try {
          const errorData = JSON.parse(errorText);
          console.error(`Error: ${errorData.error || errorData.message || errorText}`);
        } catch {
          console.error(`Error: ${errorText}`);
        }
      }
      process.exit(1);
    }

    const resumeData = await resumeResponse.json() as ResumeResponse;
    const streamUrl = `${baseUrl}${resumeData.streamUrl}`;

    if (!options.json) {
      console.log(`Connected to stream: ${resumeData.streamingId}`);
      console.log('=' + '='.repeat(50));
    }

    // 2. Connect to streaming endpoint
    const messages: any[] = [];
    let streamClosed = false;

    const eventSource = new EventSource(streamUrl);

    // Set up promise to wait for streaming completion
    const streamingComplete = new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        logger.warn('Streaming timeout reached');
        reject(new Error('Streaming timeout - conversation may still be running'));
      }, 300000); // 5 minute timeout

      eventSource.onopen = () => {
        logger.debug('Resume CLI: EventSource connection opened successfully', {
          streamUrl,
          readyState: eventSource.readyState
        });
        if (!options.json) {
          console.log('🔗 Connected to stream');
        }
      };

      eventSource.onmessage = (event) => {
        logger.debug('Resume CLI: Received SSE message from backend', {
          eventType: event.type,
          dataLength: event.data?.length || 0,
          dataPreview: event.data?.substring(0, 200) + (event.data?.length > 200 ? '...' : ''),
          lastEventId: event.lastEventId,
          origin: event.origin,
          timestamp: new Date().toISOString()
        });
        
        try {
          const data = JSON.parse(event.data);
          messages.push(data);

          logger.debug('Resume CLI: Successfully parsed SSE message', {
            type: data.type,
            subtype: data.subtype,
            streamingId: data.streaming_id || data.streamingId,
            sessionId: data.session_id,
            isAssistantError: data.type === 'assistant' && data.message?.content?.[0]?.text?.includes('API Error'),
            timestamp: data.timestamp,
            messageKeys: Object.keys(data),
            rawEventData: options.debug ? event.data : undefined
          });
          
          if (options.debug && !options.json) {
            console.log(`🐛 Received: ${data.type} (${new Date().toISOString()})`);
          }

          // Handle different message types
          if (data.type === 'connected') {
            if (!options.json) {
              console.log(`📡 Stream connected (ID: ${data.streaming_id})`);
            }
          } else if (data.type === 'system') {
            if (options.json) {
              console.log(JSON.stringify(data, null, 2));
            } else {
              console.log(`🔧 System: ${data.subtype || 'message'}`);
              if (data.model) {
                console.log(`   Model: ${data.model}`);
              }
              if (data.cwd) {
                console.log(`   Working Directory: ${data.cwd}`);
              }
            }
          } else if (data.type === 'assistant') {
            if (options.json) {
              console.log(JSON.stringify(data, null, 2));
            } else {
              console.log('\n🤖 Assistant:');
              if (data.message?.content) {
                if (Array.isArray(data.message.content)) {
                  for (const content of data.message.content) {
                    if (content.type === 'text' && content.text) {
                      console.log(content.text);
                    } else if (content.type === 'tool_use') {
                      console.log(`🔧 Using tool: ${content.name}`);
                    }
                  }
                } else if (typeof data.message.content === 'string') {
                  console.log(data.message.content);
                }
              }
            }
          } else if (data.type === 'user') {
            if (options.json) {
              console.log(JSON.stringify(data, null, 2));
            } else {
              console.log('\n👤 User:');
              if (data.message?.content) {
                if (Array.isArray(data.message.content)) {
                  for (const content of data.message.content) {
                    if (content.type === 'text' && content.text) {
                      console.log(content.text);
                    }
                  }
                } else if (typeof data.message.content === 'string') {
                  console.log(data.message.content);
                }
              }
            }
          } else if (data.type === 'result') {
            if (options.json) {
              console.log(JSON.stringify(data, null, 2));
            } else {
              console.log('\n✅ Result:');
              if (data.result) {
                console.log(data.result);
              }
            }
          } else if (data.type === 'closed') {
            streamClosed = true;
            logger.debug('Stream closed message received');
            if (!options.json) {
              console.log('\n🔚 Conversation completed');
            }
            clearTimeout(timeout);
            resolve();
          } else if (data.type === 'error') {
            logger.error('Stream error received', undefined, { 
              errorData: data,
              errorMessage: data.message,
              errorCode: data.code,
              errorDetails: data.details,
              streamingId: data.streamingId || data.streaming_id,
              timestamp: data.timestamp,
              rawErrorData: JSON.stringify(data)
            });
            
            if (options.debug && !options.json) {
              console.error(`🐛 Raw error data: ${JSON.stringify(data, null, 2)}`);
            }
            
            if (options.json) {
              console.log(JSON.stringify(data, null, 2));
            } else {
              console.error(`❌ Stream Error: ${data.message || data.error?.message || data.error || 'Unknown error'}`);
              if (data.code || data.error?.code) {
                console.error(`   Error Code: ${data.code || data.error?.code}`);
              }
              if (data.details || data.error?.details) {
                console.error(`   Details: ${JSON.stringify(data.details || data.error?.details, null, 2)}`);
              }
              if (data.error?.type) {
                console.error(`   Error Type: ${data.error.type}`);
              }
              if (data.streamingId || data.streaming_id) {
                console.error(`   Stream ID: ${data.streamingId || data.streaming_id}`);
              }
              if (data.error && typeof data.error === 'object') {
                console.error(`   Full Error: ${JSON.stringify(data.error, null, 2)}`);
              }
            }
          } else {
            // Unknown message type - just log in JSON mode or show generic message
            if (options.json) {
              console.log(JSON.stringify(data, null, 2));
            } else {
              console.log(`📨 ${data.type}: ${JSON.stringify(data, null, 2)}`);
            }
          }
        } catch (error) {
          logger.error('Error parsing stream message', error, { 
            eventData: event.data,
            eventType: event.type,
            eventOrigin: event.origin,
            eventLastEventId: event.lastEventId,
            rawData: event.data?.substring(0, 500) + (event.data?.length > 500 ? '...' : ''),
            parsingError: error instanceof Error ? error.message : String(error)
          });
          
          if (!options.json) {
            console.error(`❌ Failed to parse stream message: ${error instanceof Error ? error.message : String(error)}`);
            console.error(`   Raw data: ${event.data?.substring(0, 200)}${event.data?.length > 200 ? '...' : ''}`);
          }
          
          clearTimeout(timeout);
          reject(error);
        }
      };

      eventSource.onerror = (error) => {
        logger.error('Resume CLI: EventSource connection error', error, { 
          streamClosed,
          readyState: eventSource.readyState,
          url: streamUrl,
          errorType: error?.type,
          errorMessage: error?.message,
          errorTarget: error?.target ? 'EventSource' : undefined,
          totalMessagesReceived: messages.length,
          lastMessageType: messages[messages.length - 1]?.type,
          timestamp: new Date().toISOString()
        });
        
        // SSE connections naturally close when server ends stream
        // Only reject if we haven't seen the close event
        if (!streamClosed) {
          clearTimeout(timeout);
          const errorMessage = error?.message || error?.type || 'Unknown connection error';
          reject(new Error(`Stream connection error: ${errorMessage}`));
        }
      };
    });

    // 3. Wait for streaming to complete
    await streamingComplete;

    // 4. Final output
    if (options.json) {
      console.log(JSON.stringify({
        streamingId: resumeData.streamingId,
        messages: messages,
        totalMessages: messages.length
      }, null, 2));
    } else {
      console.log(`\n📊 Total messages received: ${messages.length}`);
    }

    // 5. Cleanup
    eventSource.close();
    logger.debug('Resume command completed successfully');

  } catch (error) {
    logger.error('Resume command failed', error);
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
        console.error(`❌ Cannot connect to CCUI server at port ${serverPort}. Is the server running?`);
        console.error(`   Try: ccui serve --port ${serverPort}`);
      } else if (error.message.includes('timeout')) {
        console.error('⏰ Stream timed out - conversation may still be running on server');
      } else {
        console.error(`❌ Error: ${error.message}`);
      }
    } else {
      console.error(`❌ Unexpected error: ${error}`);
    }
    
    process.exit(1);
  }
}