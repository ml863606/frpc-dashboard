# FRP Dashboard

A modern web-based dashboard for managing FRP (Fast Reverse Proxy) client configurations with real-time monitoring and control capabilities.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-green.svg)
![Platform](https://img.shields.io/badge/platform-Windows-lightgrey.svg)

## Features

### Core Functionality
- 📊 **Visual Proxy Management** - View and manage all FRP proxy configurations in an intuitive interface
- ➕ **Add/Edit/Delete Proxies** - Full CRUD operations for proxy configurations
- 🔄 **Real-time Status Monitoring** - Monitor FRP client status with automatic 5-second interval checks
- 📝 **Live Log Display** - View FRP client logs in real-time
- 🎨 **Dual View Modes** - Switch between card and list views for proxy display

### Advanced Features
- 🔌 **Connection Management** - Start/stop FRP client directly from the dashboard
- 🌐 **Server Configuration** - Edit FRP server settings (IP, port, authentication) on the fly
- 🔍 **Connectivity Testing** - Test server connectivity with ping and telnet before saving
- 🚫 **Duplicate Detection** - Automatic validation to prevent duplicate proxy configurations
- 🌍 **Public IP Display** - Shows local machine's public IP for easy reference
- 🔐 **Authentication Support** - Supports both token and no-auth modes

## Screenshots

### Main Dashboard
- Card view with proxy status indicators
- Real-time FRP client status display
- Inline server configuration editing

### Features in Action
- Add new proxy with validation
- Real-time connectivity testing
- Live log streaming during connection

## Installation

### Prerequisites
- Node.js (v14.0.0 or higher)
- Windows operating system
- FRP client binary (`frpc.exe`)

### Quick Start

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/frp-dashboard.git
cd frp-dashboard
```

2. **Install dependencies**
```bash
npm install
```

3. **Configure FRP path**
Edit `server.js` and update the TOML file path:
```javascript
const TOML_FILE_PATH = 'D:\\path\\to\\your\\frpc.toml';
```

4. **Start the server**
```bash
npm start
```

5. **Access the dashboard**
Open your browser and navigate to:
```
http://localhost:3001
```

## Configuration

### Server Configuration
The dashboard runs on port 3001 by default. To change this, edit `server.js`:
```javascript
const PORT = 3001; // Change to your desired port
```

### FRP Configuration
The dashboard reads and manages the `frpc.toml` file. Example configuration:
```toml
serverAddr = "your.server.ip"
serverPort = 7000

[[proxies]]
name = "web"
type = "tcp"
localIP = "127.0.0.1"
localPort = 80
remotePort = 8080
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/proxies` | Get all proxy configurations |
| POST | `/api/proxies` | Add a new proxy |
| DELETE | `/api/proxies/:index` | Delete a proxy |
| GET | `/api/public-ip` | Get local machine's public IP |
| POST | `/api/test-connectivity` | Test server connectivity |
| PUT | `/api/server-config` | Update server configuration |
| POST | `/api/connect-frps` | Start FRP client |
| POST | `/api/stop-frpc` | Stop FRP client |
| GET | `/api/frpc-logs` | Get FRP client logs |
| GET | `/api/frpc-system-status` | Check FRP client system status |

## Project Structure

```
frpc-dashboard/
├── server.js           # Express server and API endpoints
├── index.html          # Main dashboard interface
├── package.json        # Project dependencies
├── README.md          # Project documentation
└── node_modules/      # Dependencies
```

## Technology Stack

- **Backend**: Node.js, Express.js
- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Real-time Communication**: Server-Sent Events (SSE)
- **Process Management**: Child Process (spawn)
- **File Operations**: Native fs module

## Features Walkthrough

### Adding a New Proxy
1. Click the "添加代理" button
2. Fill in proxy details (name, type, IP, ports)
3. Test connectivity (optional)
4. Save the configuration

### Managing Server Settings
1. Edit server IP/port directly in the header
2. Choose authentication method (None/Token)
3. Test connectivity before saving
4. Click "保存" to update configuration

### Monitoring FRP Status
- Green indicator: FRP client is running
- Red indicator: FRP client is stopped
- Auto-refresh every 5 seconds
- One-click start/stop control

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
npx kill-port 3001
npm start
```

**FRP Client Exit Code 3221225794**
- Check for port conflicts in proxy configuration
- Ensure all required DLLs are present
- Verify Windows permissions

**Cannot Find frpc.exe**
- Update the path in server.js to point to your frpc.exe location
- Ensure the binary has execute permissions

## Development

### Running in Development Mode
```bash
npm run dev
```

### Building for Production
The application runs directly with Node.js and doesn't require a build step.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [FRP](https://github.com/fatedier/frp) - Fast reverse proxy
- [Express.js](https://expressjs.com/) - Web framework
- [Node.js](https://nodejs.org/) - JavaScript runtime

## Support

If you encounter any issues or have questions, please [open an issue](https://github.com/yourusername/frp-dashboard/issues) on GitHub.

---

Made with ❤️ for the FRP community