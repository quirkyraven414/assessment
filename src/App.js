import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [connected, setConnected] = useState(false);
  const [telemetry, setTelemetry] = useState(null);
  const [alert, setAlert] = useState(null);
  const [alertResolved, setAlertResolved] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    // Load saved data from localStorage
    const savedTelemetry = localStorage.getItem('lastTelemetry');
    const savedAlert = localStorage.getItem('lastAlert');
    
    if (savedTelemetry) {
      setTelemetry(JSON.parse(savedTelemetry));
    }
    if (savedAlert) {
      setAlert(JSON.parse(savedAlert));
    }

    connectWebSocket();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:8000/ws/telemetry');
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received:', message);

      if (message.type === 'telemetry') {
        setTelemetry(message.data);
        localStorage.setItem('lastTelemetry', JSON.stringify(message.data));
        
        // Check if alert should be resolved (temperature back to normal)
        setAlertResolved(prev => {
          const savedAlert = localStorage.getItem('lastAlert');
          if (savedAlert && message.data.temperature < 30) {
            return true;
          }
          return prev;
        });
      } else if (message.type === 'alert') {
        setAlert(message.data);
        localStorage.setItem('lastAlert', JSON.stringify(message.data));
        setAlertResolved(false);
      }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  };

  return (
    <div className="App">
      <div className="container">
        <header className="header">
          <h1>🌡️ IoT Telemetry Dashboard</h1>
          <div className={`status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 Connected' : '⚫ Disconnected'}
          </div>
        </header>

        <section className="section">
          <h2>📊 Latest Telemetry</h2>
          {telemetry ? (
            <div className="data-grid">
              <DataCard label="Device ID" value={telemetry.device_id} />
              <DataCard label="Status" value={telemetry.status} />
              <DataCard label="Temperature" value={`${telemetry.temperature.toFixed(1)} °C`} />
              <DataCard label="Voltage" value={`${telemetry.voltage.toFixed(1)} V`} />
              <DataCard label="Current" value={`${telemetry.current.toFixed(1)} A`} />
              <DataCard label="Energy" value={`${telemetry.energy_kwh.toFixed(2)} kWh`} />
            </div>
          ) : (
            <div className="no-data">No telemetry data received yet</div>
          )}
          {telemetry && (
            <div className="timestamp">
              Last updated: {new Date(telemetry.timestamp).toLocaleString()}
            </div>
          )}
        </section>

        <section className="section">
          <h2>🚨 Latest Alert</h2>
          {alert ? (
            <div className={`alert-box ${alertResolved ? 'RESOLVED' : alert.severity}`}>
              {alertResolved && (
                <div className="resolved-badge">✅ RESOLVED</div>
              )}
              <div className="alert-type">
                {alert.alert_type.replace(/_/g, ' ')}
              </div>
              <div className="alert-message">{alert.message}</div>
              <div className="timestamp">
                Triggered: {new Date(alert.triggered_at).toLocaleString()}
              </div>
            </div>
          ) : (
            <div className="no-data">No alerts yet</div>
          )}
        </section>
      </div>
    </div>
  );
}

function DataCard({ label, value }) {
  return (
    <div className="data-card">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  );
}

export default App;
