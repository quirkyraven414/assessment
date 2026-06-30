# IoT Telemetry System - Mermaid Architecture Diagram

## Complete System Architecture

```mermaid
graph TB
    subgraph DEVICE_LAYER["🌐 DEVICE LAYER"]
        DEV1["IoT Device DEV001<br/>• Sensors<br/>• API Key<br/>• 60s Heartbeat"]
        DEV2["IoT Device DEV002<br/>• Sensors<br/>• API Key<br/>• 60s Heartbeat"]
        DEV3["IoT Device DEV003<br/>• Sensors<br/>• API Key<br/>• 60s Heartbeat"]
        DEVN["... (1000s devices)"]
    end

    subgraph API_GATEWAY["⚡ API GATEWAY LAYER"]
        LB["Load Balancer<br/>(Nginx - IPv4)<br/>• Round Robin<br/>• Health Checks<br/>• SSL Termination"]
        
        subgraph API_NODES["API Nodes (NestJS)"]
            API1["API Node 1<br/>Endpoints:<br/>• POST /telemetry<br/>• GET /devices/:id/latest<br/>• GET /alerts<br/>• POST /devices<br/>• GET /health"]
            API2["API Node 2<br/>Endpoints:<br/>• POST /telemetry<br/>• GET /devices/:id/latest<br/>• GET /alerts<br/>• POST /devices<br/>• GET /health"]
            APIN["API Node N<br/>Endpoints:<br/>• POST /telemetry<br/>• GET /devices/:id/latest<br/>• GET /alerts<br/>• POST /devices<br/>• GET /health"]
        end
    end

    subgraph API_PROCESSING["🔄 API PROCESSING PIPELINE"]
        AUTH["Step 1: AUTHENTICATION<br/>• Validate API Key<br/>• Check device exists<br/>• Return 401 if invalid"]
        IDEMP["Step 2: REDIS IDEMPOTENCY<br/>• Key: idempotency:{device_id}<br/>• TTL: 10 seconds<br/>• Return cached if exists"]
        VALID["Step 3: VALIDATION<br/>• device_id: Required<br/>• temperature: 0-60°C<br/>• voltage: 0-500V<br/>• current: 0-100A<br/>• timestamp: Not future, max 5min late<br/>• energy_kwh: >= 0"]
        ENRICH["Step 4: ENRICH & PRODUCE<br/>• Generate message_id (UUID)<br/>• Add ingested_at<br/>• Update device.last_seen_at<br/>• Produce to Kafka"]
    end

    INVALID_DB[("PostgreSQL<br/>invalid_messages<br/>• message_id<br/>• device_id<br/>• telemetry_message<br/>• reason_for_failure<br/>• rejected_at")]

    subgraph KAFKA_CLUSTER["📨 KAFKA CLUSTER"]
        PRODUCER["Kafka Producer<br/>Config:<br/>• acks: -1<br/>• retries: 5<br/>• retry.backoff: exponential<br/>• compression: snappy<br/>• batch.size: 16KB<br/>• linger.ms: 10ms"]
        
        subgraph TOPIC["Topic: telemetry.raw"]
            P0["Partition 0<br/>DEV001, DEV004..."]
            P1["Partition 1<br/>DEV002, DEV005..."]
            P2["Partition 2<br/>DEV003, DEV006..."]
        end
        
        TOPIC_CONFIG["Config:<br/>• Partitions: 3→12→48<br/>• Replication: 3<br/>• Retention: 7 days<br/>• min.insync.replicas: 2<br/>• Partition Key: device_id"]
        
        subgraph CONSUMER_GROUP["Consumer Group: telemetry-processors"]
            C1["Consumer 1<br/>(Partition 0)"]
            C2["Consumer 2<br/>(Partition 1)"]
            CN["Consumer N<br/>(Partition 2)"]
        end
        
        CONSUMER_CONFIG["Config:<br/>• Batch: 500 messages<br/>• autoCommit: false<br/>• Retry: 3 attempts<br/>• Circuit breaker: 5 failures"]
    end

    subgraph PROCESSING["⚙️ PROCESSING & STORAGE LAYER"]
        PROC_CONSUMER["Processor Consumer<br/>For each batch (500 msgs):<br/>1. Parse messages<br/>2. Batch INSERT to DB<br/>3. Evaluate alert rules<br/>4. Store alerts in DB<br/>5. Publish to Redis Pub/Sub<br/>6. Commit Kafka offsets"]
        
        subgraph STORAGE["Storage Components"]
            DB[("PostgreSQL + TimescaleDB<br/>Tables:<br/>1. devices<br/>2. telemetry (hypertable)<br/>3. alerts<br/>4. invalid_messages<br/><br/>UNIQUE: (device_id, timestamp, message_id)<br/>Scaling: Read replicas, Sharding, Compression (90%)")]
            
            REDIS_CACHE[("Redis<br/>Keys:<br/>• idempotency:{id} (TTL: 10s)<br/><br/>Performance:<br/>• GET: < 1ms<br/>• SET: < 1ms")]
            
            ALERT_ENGINE["Alert Engine<br/>Rules:<br/>1. Temp > 30°C (HIGH)<br/>2. Temp > 50°C (CRITICAL)<br/>3. Energy spike > 50% (MEDIUM)<br/>4. Device offline (HIGH)<br/>5. Voltage abnormal (MEDIUM)<br/>6. Current > 80A (HIGH)<br/>7. All zeros (MEDIUM)<br/>8. Rapid changes (MEDIUM)<br/><br/>Output:<br/>• Store in alerts table<br/>• Publish to Redis Pub/Sub"]
        end
    end

    subgraph REALTIME["🔴 REAL-TIME BROADCAST LAYER"]
        PUBSUB["Redis Pub/Sub (FANOUT)<br/>Channels:<br/>• telemetry:device:{id}<br/>• alerts:all<br/>• alerts:device:{id}<br/>• alerts:type:{type}<br/>• alerts:severity:{level}<br/><br/>Fanout: 1 PUBLISH → Multiple Subscribers"]
        
        subgraph SUBSCRIBERS["Subscribers"]
            WS["WebSocket Server (NestJS)<br/>Subscribes to:<br/>• telemetry:device:{id}<br/>• alerts:all<br/><br/>Broadcasts to:<br/>• Web clients (Socket.IO)"]
            EMAIL["Email Service<br/>Subscribes to:<br/>• alerts:severity:CRITICAL<br/>• alerts:severity:HIGH<br/><br/>Sends email to:<br/>• admin@..."]
            PUSH["Mobile Push Service<br/>Subscribes to:<br/>• alerts:severity:CRITICAL<br/><br/>Sends push to:<br/>• Mobile apps"]
        end
    end

    WEB["🌍 Web Clients (Browser)<br/>• Dashboard<br/>• Real-time telemetry<br/>• Real-time alerts<br/>• Device status"]

    subgraph ALERTS_DASHBOARD["📊 ALERTS & DASHBOARDS"]
        OPENSEARCH["OpenSearch<br/>(Alerts Storage)<br/>Index: iot-alerts<br/>• Search alerts<br/>• Aggregations<br/>• Time queries"]
        SUPERSET["Apache Superset<br/>(Dashboards)<br/>• Device Overview<br/>• Telemetry Charts<br/>• Alerts Dashboard<br/><br/>Data Sources:<br/>• PostgreSQL<br/>• OpenSearch"]
        HEALTH["Health Checks<br/>GET /health<br/>• Database: up/down<br/>• Redis: up/down<br/>• Kafka: up/down"]
    end

    subgraph OFFLINE_DETECTION["⏰ OFFLINE DEVICE DETECTION"]
        CRON["Cron Job (Every 1 min)<br/>Check: last_seen_at < NOW() - 5min<br/>Action:<br/>1. UPDATE devices SET status='offline'<br/>2. INSERT INTO alerts<br/>3. PUBLISH to Redis Pub/Sub"]
    end

    %% Device Layer Connections
    DEV1 & DEV2 & DEV3 & DEVN -->|"HTTPS POST /telemetry<br/>Headers: X-API-Key<br/>Body: {device_id, temp, voltage...}"| LB

    %% API Gateway Connections
    LB --> API1 & API2 & APIN

    %% API Processing Pipeline
    API1 & API2 & APIN --> AUTH
    AUTH --> IDEMP
    IDEMP --> VALID
    VALID -->|"PASSED"| ENRICH
    VALID -->|"FAILED"| INVALID_DB

    %% Kafka Connections
    ENRICH --> PRODUCER
    PRODUCER --> P0 & P1 & P2
    P0 --> C1
    P1 --> C2
    P2 --> CN

    %% Processing Connections
    C1 & C2 & CN --> PROC_CONSUMER
    PROC_CONSUMER --> DB
    PROC_CONSUMER --> ALERT_ENGINE
    ALERT_ENGINE --> DB
    ALERT_ENGINE --> PUBSUB

    %% Real-time Broadcast
    PUBSUB --> WS & EMAIL & PUSH
    WS --> WEB

    %% Alerts & Dashboards
    ALERT_ENGINE -->|"index alerts"| OPENSEARCH
    DB -.->|"query telemetry"| SUPERSET
    OPENSEARCH -.->|"query alerts"| SUPERSET

    %% Offline Detection
    CRON -.->|"checks"| DB
    CRON -.->|"publishes"| PUBSUB

    %% Styling
    classDef deviceClass fill:#e1f5ff,stroke:#01579b,stroke-width:2px
    classDef apiClass fill:#fff3e0,stroke:#e65100,stroke-width:2px
    classDef kafkaClass fill:#e8f5e9,stroke:#1b5e20,stroke-width:2px
    classDef storageClass fill:#fce4ec,stroke:#880e4f,stroke-width:2px
    classDef realtimeClass fill:#f3e5f5,stroke:#4a148c,stroke-width:2px
    classDef monitorClass fill:#fff9c4,stroke:#f57f17,stroke-width:2px

    class DEV1,DEV2,DEV3,DEVN deviceClass
    class LB,API1,API2,APIN,AUTH,RATE,IDEMP,VALID,ENRICH apiClass
    class PRODUCER,P0,P1,P2,C1,C2,CN kafkaClass
    class DB,REDIS_CACHE,ALERT_ENGINE,INVALID_DB storageClass
    class PUBSUB,WS,EMAIL,PUSH,WEB realtimeClass
    class OPENSEARCH,SUPERSET,HEALTH,CRON monitorClass
```

---

## Simplified Data Flow Diagram

```mermaid
sequenceDiagram
    participant Device as IoT Device
    participant LB as Load Balancer
    participant API as API Node
    participant Redis as Redis Cache
    participant Kafka as Kafka Topic
    participant Consumer as Processor Consumer
    participant DB as PostgreSQL
    participant AlertEngine as Alert Engine
    participant PubSub as Redis Pub/Sub
    participant WS as WebSocket Server
    participant Client as Web Client

    Note over Device,Client: Phase 1: Ingestion (< 50ms)
    Device->>LB: POST /telemetry + API Key
    LB->>API: Route request
    
    API->>API: 1. Authenticate API Key
    API->>API: 2. Rate Limit Check
    API->>Redis: 3. Idempotency Check
    Redis-->>API: Cache miss
    API->>API: 4. Validate (temp, voltage, etc.)
    
    alt Validation Failed
        API->>DB: Store in invalid_messages
        API-->>Device: 400 Bad Request
    else Validation Passed
        API->>API: 5. Enrich (message_id, ingested_at)
        API->>Kafka: Produce to telemetry.raw
        API->>Redis: Cache response (10s TTL)
        API->>DB: Update device.last_seen_at
        API-->>Device: 202 Accepted
    end

    Note over Kafka,DB: Phase 2: Processing (< 200ms)
    Kafka->>Consumer: Poll batch (500 messages)
    Consumer->>Consumer: Parse messages
    
    par Parallel Processing
        Consumer->>DB: Batch INSERT telemetry (500 rows)
        Consumer->>Redis: Update device:{id}:latest (24h TTL)
        Consumer->>AlertEngine: Evaluate 8 alert rules
    end
    
    AlertEngine->>AlertEngine: Check rules (temp, energy, voltage...)
    
    alt Alert Triggered
        AlertEngine->>DB: INSERT INTO alerts
        AlertEngine->>PubSub: PUBLISH to alerts:all, alerts:device:{id}
    end
    
    Consumer->>PubSub: PUBLISH to telemetry:device:{id}
    Consumer->>Kafka: Commit offsets
    
    Note over PubSub,Client: Phase 3: Real-time Broadcast (< 10ms)
    PubSub->>WS: Fanout to WebSocket Server
    PubSub->>WS: Fanout to Email Service
    PubSub->>WS: Fanout to Push Service
    
    WS->>Client: WebSocket broadcast (Socket.IO)
    Client->>Client: Update UI (telemetry + alerts)
```

---

## Component Interaction Diagram

```mermaid
graph LR
    subgraph External
        IOT[IoT Devices]
        BROWSER[Web Browser]
    end

    subgraph API_Layer["API Layer"]
        LB[Load Balancer]
        API[API Nodes]
    end

    subgraph Message_Queue["Message Queue"]
        KAFKA[Kafka Cluster]
    end

    subgraph Processing_Layer["Processing Layer"]
        CONSUMER[Kafka Consumers]
    end

    subgraph Data_Layer["Data Layer"]
        POSTGRES[(PostgreSQL + TimescaleDB)]
        REDIS[(Redis Cache)]
    end

    subgraph Alert_Layer["Alert Layer"]
        ALERT[Alert Engine]
        PUBSUB[Redis Pub/Sub]
    end

    subgraph Realtime_Layer["Real-time Layer"]
        WS[WebSocket Server]
        EMAIL[Email Service]
        PUSH[Push Service]
    end

    subgraph Dashboard_Layer["Alerts & Dashboards"]
        OPENSEARCH[OpenSearch]
        SUPERSET[Apache Superset]
    end

    IOT -->|HTTPS| LB
    LB --> API
    API -->|Produce| KAFKA
    API <-->|Cache/Idempotency| REDIS
    API -->|Invalid msgs| POSTGRES
    
    KAFKA --> CONSUMER
    CONSUMER --> POSTGRES
    CONSUMER --> REDIS
    CONSUMER --> ALERT
    
    ALERT --> POSTGRES
    ALERT --> PUBSUB
    ALERT -->|Index| OPENSEARCH
    
    PUBSUB --> WS
    PUBSUB --> EMAIL
    PUBSUB --> PUSH
    
    WS -->|WebSocket| BROWSER
    
    POSTGRES -.->|Query| SUPERSET
    OPENSEARCH -.->|Query| SUPERSET
    SUPERSET -->|View| BROWSER

    classDef external fill:#e1f5ff,stroke:#01579b
    classDef api fill:#fff3e0,stroke:#e65100
    classDef queue fill:#e8f5e9,stroke:#1b5e20
    classDef storage fill:#fce4ec,stroke:#880e4f
    classDef realtime fill:#f3e5f5,stroke:#4a148c
    classDef monitor fill:#fff9c4,stroke:#f57f17

    class IOT,BROWSER external
    class LB,API api
    class KAFKA,CONSUMER queue
    class POSTGRES,REDIS storage
    class ALERT,PUBSUB,WS,EMAIL,PUSH realtime
    class OPENSEARCH,SUPERSET monitor
```

---

## Scaling Strategy Diagram

```mermaid
graph TB
    subgraph MVP["MVP (1K devices)"]
        API_MVP["API: 2 instances"]
        KAFKA_MVP["Kafka: 3 partitions"]
        CONSUMER_MVP["Consumer: 1 instance"]
        DB_MVP["DB: Single instance"]
    end

    subgraph SCALE_10K["Scale to 10K devices"]
        API_10K["API: 5 instances"]
        KAFKA_10K["Kafka: 12 partitions"]
        CONSUMER_10K["Consumer: 3 instances"]
        DB_10K["DB: + Read replica"]
        REDIS_10K["Redis: Cluster (3 nodes)"]
    end

    subgraph SCALE_100K["Scale to 100K devices"]
        API_100K["API: 20 instances<br/>(Auto-scaling)"]
        KAFKA_100K["Kafka: 48 partitions"]
        CONSUMER_100K["Consumer: 12 instances"]
        DB_100K["DB: Sharding by device_id"]
        REDIS_100K["Redis: Cluster (6 nodes)"]
        CDN["CDN: Static assets"]
    end

    MVP --> SCALE_10K
    SCALE_10K --> SCALE_100K

    style MVP fill:#e8f5e9,stroke:#1b5e20
    style SCALE_10K fill:#fff3e0,stroke:#e65100
    style SCALE_100K fill:#fce4ec,stroke:#880e4f
```

---

## Alert Rules Flow

```mermaid
graph TD
    START[Telemetry Data] --> CHECK1{Temperature > 30°C?}
    CHECK1 -->|Yes| ALERT1[HIGH: Temperature High]
    CHECK1 -->|No| CHECK2{Temperature > 50°C?}
    
    CHECK2 -->|Yes| ALERT2[CRITICAL: Temperature Critical]
    CHECK2 -->|No| CHECK3{Energy spike > 50%?}
    
    CHECK3 -->|Yes| ALERT3[MEDIUM: Energy Spike]
    CHECK3 -->|No| CHECK4{Device offline?}
    
    CHECK4 -->|Yes| ALERT4[HIGH: Device Offline]
    CHECK4 -->|No| CHECK5{Voltage abnormal?}
    
    CHECK5 -->|Yes| ALERT5[MEDIUM: Voltage Abnormal]
    CHECK5 -->|No| CHECK6{Current > 80A?}
    
    CHECK6 -->|Yes| ALERT6[HIGH: Current High]
    CHECK6 -->|No| CHECK7{All zeros?}
    
    CHECK7 -->|Yes| ALERT7[MEDIUM: Suspicious Values]
    CHECK7 -->|No| CHECK8{Rapid changes?}
    
    CHECK8 -->|Yes| ALERT8[MEDIUM: Rapid Changes]
    CHECK8 -->|No| END[No Alert]
    
    ALERT1 & ALERT2 & ALERT3 & ALERT4 & ALERT5 & ALERT6 & ALERT7 & ALERT8 --> STORE[Store in alerts table]
    STORE --> PUBLISH[Publish to Redis Pub/Sub]
    PUBLISH --> NOTIFY[Notify subscribers]

    style ALERT1 fill:#ff9800
    style ALERT2 fill:#f44336
    style ALERT3 fill:#ffeb3b
    style ALERT4 fill:#ff9800
    style ALERT5 fill:#ffeb3b
    style ALERT6 fill:#ff9800
    style ALERT7 fill:#ffeb3b
    style ALERT8 fill:#ffeb3b
```

---

## Redis Pub/Sub Fanout

```mermaid
graph LR
    PUBLISHER[Processor Consumer] -->|PUBLISH| CHANNEL1[telemetry:device:DEV001]
    PUBLISHER -->|PUBLISH| CHANNEL2[alerts:all]
    PUBLISHER -->|PUBLISH| CHANNEL3[alerts:device:DEV001]
    PUBLISHER -->|PUBLISH| CHANNEL4[alerts:type:TEMPERATURE_HIGH]
    PUBLISHER -->|PUBLISH| CHANNEL5[alerts:severity:HIGH]

    CHANNEL1 --> SUB1[WebSocket Server]
    CHANNEL2 --> SUB2[WebSocket Server]
    CHANNEL2 --> SUB3[Logging Service]
    CHANNEL3 --> SUB4[Device Dashboard]
    CHANNEL4 --> SUB5[Temperature Monitor]
    CHANNEL5 --> SUB6[Email Service]
    CHANNEL5 --> SUB7[Mobile Push]

    SUB1 --> CLIENT1[Web Client 1]
    SUB1 --> CLIENT2[Web Client 2]
    SUB1 --> CLIENT3[Web Client N]

    style PUBLISHER fill:#4caf50,stroke:#1b5e20
    style CHANNEL1 fill:#2196f3,stroke:#0d47a1
    style CHANNEL2 fill:#2196f3,stroke:#0d47a1
    style CHANNEL3 fill:#2196f3,stroke:#0d47a1
    style CHANNEL4 fill:#2196f3,stroke:#0d47a1
    style CHANNEL5 fill:#2196f3,stroke:#0d47a1
    style SUB1 fill:#ff9800,stroke:#e65100
    style SUB2 fill:#ff9800,stroke:#e65100
    style SUB3 fill:#ff9800,stroke:#e65100
    style SUB4 fill:#ff9800,stroke:#e65100
    style SUB5 fill:#ff9800,stroke:#e65100
    style SUB6 fill:#ff9800,stroke:#e65100
    style SUB7 fill:#ff9800,stroke:#e65100
```

---

### **Key Components (Easy to Explain)**

1. **Load Balancer (Nginx - IPv4)**
   - Simple round-robin load balancing
   - SSL termination
   - Health checks

2. **API Layer (NestJS)**
   - Authentication, validation, idempotency
   - Produces to Kafka

3. **Kafka (Message Queue)**
   - 3 partitions for scalability
   - Reliable message delivery

4. **Processor Consumer**
   - Reads from Kafka
   - Stores in PostgreSQL
   - Evaluates alerts
   - Publishes to Redis Pub/Sub

5. **PostgreSQL + TimescaleDB**
   - Stores telemetry and alerts
   - Time-series optimized

6. **Redis**
   - Idempotency (10s TTL) - API layer
   - Pub/Sub (real-time broadcast)

7. **OpenSearch (Alerts Only)**
   - Stores alerts for search and analysis
   - Easy to query by device, severity, time

8. **Apache Superset (Dashboards)**
   - Connects to PostgreSQL (telemetry)
   - Connects to OpenSearch (alerts)
   - Creates charts and dashboards

9. **WebSocket Server**
   - Subscribes to Redis Pub/Sub
   - Broadcasts to web clients
