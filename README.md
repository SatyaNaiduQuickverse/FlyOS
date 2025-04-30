# FlyOS: Military-Grade Drone Control System

A sophisticated drone control system with multiple access levels and robust security designed to manage hundreds of drones across different geographical regions with a hierarchical command structure.

## System Hierarchy and Access Levels

1. **Main HQ Level**
   - Top-level command center with global oversight
   - Full access to all drones and regional operations
   - Ability to assign drones to regions and manage all system components

2. **Regional HQ Level**
   - Mid-level command centers focused on specific geographical regions
   - Access limited to drones within their designated region
   - Can manage operators within their region and assign missions

3. **Operator Level**
   - Ground-level field operators using mobile-friendly interfaces
   - Access restricted to drones specifically assigned to them
   - Focused on direct drone control and mission execution

## Core System Architecture

Built on a modern microservices architecture:

- **Frontend Application**: Next.js-based web application with role-specific dashboards
- **Authentication Service**: Dedicated microservice with JWT-based token system
- **Database Services**: PostgreSQL for structured user and drone data
- **Message Broker (planned)**: RabbitMQ for asynchronous communication
- **Containerization**: Docker for service containerization and deployment

## Getting Started

### Prerequisites

- Node.js (v16 or later)
- Docker and Docker Compose
- PostgreSQL (if running locally without Docker)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/flyos.git
   cd flyos
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development environment with Docker:
   ```bash
   docker-compose up
   ```

4. Access the application at `http://localhost:3000`

## Development

### Project Structure

```
flyos/
├── app/                    # Next.js application code
│   ├── (auth)/             # Authentication-related pages
│   ├── (protected)/        # Role-protected routes
│   └── api/                # API routes (server-side)
├── lib/                    # Shared utilities
├── types/                  # TypeScript type definitions
├── services/               # Microservices directory
│   └── auth/               # Authentication service
├── public/                 # Static assets
└── [Config files]          # Various configuration files
```

## License

[Specify your license here]

## Contact

[Your contact information]
