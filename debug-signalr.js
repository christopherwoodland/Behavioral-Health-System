// Temporary debugging script to test SignalR connection directly
// Paste this into your browser console to debug the connection

async function debugSignalRConnection() {
  console.log('=== SignalR Debug Test ===');
  
  try {
    // Step 1: Test negotiate endpoint
    console.log('1. Testing negotiate endpoint...');
    const negotiateResponse = await fetch('http://localhost:7071/api/negotiate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    
    if (!negotiateResponse.ok) {
      throw new Error(`Negotiate failed: ${negotiateResponse.status}`);
    }
    
    const negotiateData = await negotiateResponse.json();
    console.log('✅ Negotiate successful:', negotiateData);
    
    // Step 2: Test direct SignalR connection
    console.log('2. Testing direct SignalR connection...');
    const { HubConnectionBuilder, LogLevel } = window['@microsoft/signalr'];
    
    if (!HubConnectionBuilder) {
      console.error('❌ SignalR library not loaded');
      return;
    }
    
    const connection = new HubConnectionBuilder()
      .withUrl(negotiateData.Url || negotiateData.url, {
        accessTokenFactory: () => negotiateData.AccessToken || negotiateData.accessToken
      })
      .configureLogging(LogLevel.Debug)
      .build();
    
    // Set up event handlers
    connection.onreconnecting((error) => {
      console.log('🔄 SignalR reconnecting:', error);
    });
    
    connection.onreconnected((connectionId) => {
      console.log('✅ SignalR reconnected:', connectionId);
    });
    
    connection.onclose((error) => {
      console.log('❌ SignalR connection closed:', error);
    });
    
    // Attempt connection
    console.log('3. Starting connection...');
    await connection.start();
    console.log('✅ SignalR connection successful!');
    console.log('Connection ID:', connection.connectionId);
    console.log('Connection State:', connection.state);
    
    // Test joining a session
    console.log('4. Testing session join...');
    const sessionId = 'test-session-' + Date.now();
    const joinResponse = await fetch(`http://localhost:7071/api/session/${sessionId}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ connectionId: connection.connectionId })
    });
    
    if (joinResponse.ok) {
      console.log('✅ Session join successful');
    } else {
      console.error('❌ Session join failed:', joinResponse.status, await joinResponse.text());
    }
    
    // Cleanup
    setTimeout(() => {
      console.log('5. Cleaning up test connection...');
      connection.stop();
    }, 5000);
    
  } catch (error) {
    console.error('❌ Debug test failed:', error);
  }
}

// Run the debug test
debugSignalRConnection();