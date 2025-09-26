const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { exec, spawn } = require('child_process');
const net = require('net');
const https = require('https');

const app = express();
const PORT = 3001;

// 全局变量存储当前的frpc进程
let currentFrpcProcess = null;
let frpcLogs = []; // 存储日志

// 启用CORS
app.use(cors());
app.use(express.json());

// 静态文件服务
app.use(express.static(__dirname));

// TOML文件路径
const TOML_FILE_PATH = 'D:\\DevSoftWare\\Remote\\frp\\frp-offical\\frp_0.62.1_windows_amd64\\frpc.toml';

// 简单的TOML解析器
function parseToml(content) {
    const lines = content.split('\n').map(line => line.trim()).filter(line => line);
    const result = {
        proxies: [],
        serverInfo: {
            serverAddr: '',
            serverPort: '',
            method: '',
            token: ''
        }
    };
    let currentProxy = null;
    let currentSection = null;

    for (let line of lines) {
        // 跳过注释
        if (line.startsWith('#')) continue;

        // 检查是否是新的section
        if (line === '[[proxies]]') {
            if (currentProxy) {
                result.proxies.push(currentProxy);
            }
            currentProxy = {};
            currentSection = 'proxy';
            continue;
        } else if (line === '[auth]') {
            currentSection = 'auth';
            continue;
        } else if (line.startsWith('[') && line.endsWith(']')) {
            currentSection = 'other';
            continue;
        }

        // 解析键值对
        if (line.includes('=')) {
            const [key, value] = line.split('=').map(s => s.trim());
            const cleanValue = value.replace(/['"]/g, '');

            if (currentSection === 'proxy' && currentProxy !== null) {
                currentProxy[key] = cleanValue;
            } else if (currentSection === 'auth') {
                // 解析认证配置
                if (key === 'method') {
                    result.serverInfo.method = cleanValue;
                } else if (key === 'token') {
                    result.serverInfo.token = cleanValue;
                }
            } else if (currentSection === null || currentSection === 'other') {
                // 解析服务器配置
                if (key === 'serverAddr') {
                    result.serverInfo.serverAddr = cleanValue;
                } else if (key === 'serverPort') {
                    result.serverInfo.serverPort = cleanValue;
                }
            }
        }
    }

    // 添加最后一个proxy
    if (currentProxy) {
        result.proxies.push(currentProxy);
    }

    return result;
}

// 写入TOML文件
function writeTomlFile(proxies) {
    try {
        const content = fs.readFileSync(TOML_FILE_PATH, 'utf8');
        const lines = content.split('\n');

        // 找到最后一个[[proxies]]的位置
        let lastProxyIndex = -1;
        for (let i = lines.length - 1; i >= 0; i--) {
            if (lines[i].trim() === '[[proxies]]' || lines[i].includes('remotePort') || lines[i].includes('localPort')) {
                lastProxyIndex = i;
                break;
            }
        }

        // 添加新的proxy配置
        const newProxyLines = [
            '',
            '[[proxies]]',
            `name = "${proxies.name}"`,
            `type = "${proxies.type}"`,
            `localIP = "${proxies.localIP}"`,
            `localPort = ${proxies.localPort}`,
            `remotePort = ${proxies.remotePort}`
        ];

        // 插入新的配置
        lines.splice(lastProxyIndex + 1, 0, ...newProxyLines);

        // 写入文件
        fs.writeFileSync(TOML_FILE_PATH, lines.join('\n'), 'utf8');
        return true;
    } catch (error) {
        console.error('写入文件错误:', error);
        return false;
    }
}

// 检测远程服务器连通性
function checkRemoteServerConnectivity(serverAddr, serverPort) {
    return new Promise((resolve) => {
        // Ping测试
        exec(`ping -n 1 -w 1000 ${serverAddr}`, (pingError, pingStdout) => {
            const pingSuccess = !pingError && pingStdout.includes('TTL=');

            // Telnet测试
            const socket = new net.Socket();
            socket.setTimeout(3000);

            socket.connect(serverPort, serverAddr, () => {
                socket.destroy();
                resolve({
                    ping: pingSuccess,
                    telnet: true
                });
            });

            socket.on('error', () => {
                socket.destroy();
                resolve({
                    ping: pingSuccess,
                    telnet: false
                });
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve({
                    ping: pingSuccess,
                    telnet: false
                });
            });
        });
    });
}

// 获取本地公网IP
function getPublicIP() {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'api.ip.sb',
            port: 443,
            path: '/ip',
            method: 'GET',
            timeout: 5000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data.trim());
            });
        });

        req.on('error', (err) => {
            // 如果api.ip.sb失败，尝试ip138.com的API
            const options2 = {
                hostname: 'ip138.com',
                port: 443,
                path: '/api.php',
                method: 'GET',
                timeout: 5000
            };

            const req2 = https.request(options2, (res2) => {
                let data2 = '';
                res2.on('data', (chunk) => {
                    data2 += chunk;
                });
                res2.on('end', () => {
                    try {
                        const match = data2.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
                        if (match) {
                            resolve(match[1]);
                        } else {
                            resolve('未知');
                        }
                    } catch (e) {
                        resolve('未知');
                    }
                });
            });

            req2.on('error', () => {
                resolve('未知');
            });

            req2.on('timeout', () => {
                req2.destroy();
                resolve('未知');
            });

            req2.setTimeout(5000);
            req2.end();
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('超时'));
        });

        req.setTimeout(5000);
        req.end();
    });
}

// API路由：获取公网IP
app.get('/api/public-ip', async (req, res) => {
    try {
        const publicIP = await getPublicIP();
        res.json({
            success: true,
            ip: publicIP
        });
    } catch (error) {
        console.error('获取公网IP错误:', error);
        res.json({
            success: false,
            ip: '未知',
            error: error.message
        });
    }
});

// API路由：测试连接性
app.post('/api/test-connectivity', async (req, res) => {
    try {
        const { remotePort, serverAddr } = req.body;

        if (!remotePort) {
            return res.status(400).json({
                success: false,
                error: '远程端口是必填的'
            });
        }

        let targetServerAddr = serverAddr;

        // 如果没有提供serverAddr，则从配置文件读取
        if (!targetServerAddr) {
            const content = fs.readFileSync(TOML_FILE_PATH, 'utf8');
            const data = parseToml(content);

            if (!data.serverInfo || !data.serverInfo.serverAddr) {
                return res.status(400).json({
                    success: false,
                    error: '无法获取服务器地址信息'
                });
            }
            targetServerAddr = data.serverInfo.serverAddr;
        }

        // 检测连通性
        const connectivity = await checkRemoteServerConnectivity(
            targetServerAddr,
            parseInt(remotePort)
        );

        res.json({
            success: true,
            connectivity: connectivity,
            serverAddr: targetServerAddr,
            testedPort: remotePort
        });
    } catch (error) {
        console.error('测试连接性错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API路由：删除代理
app.delete('/api/proxies/:index', async (req, res) => {
    try {
        const index = parseInt(req.params.index);

        // 读取现有配置
        const content = fs.readFileSync(TOML_FILE_PATH, 'utf8');
        const data = parseToml(content);

        if (index < 0 || index >= data.proxies.length) {
            return res.status(400).json({
                success: false,
                error: '代理索引无效'
            });
        }

        const deletedProxy = data.proxies[index];

        // 重写整个文件，排除要删除的代理
        const lines = content.split('\n');
        let newLines = [];
        let proxyCount = 0;
        let skipLines = false;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            if (line === '[[proxies]]') {
                if (proxyCount === index) {
                    // 开始跳过要删除的代理
                    skipLines = true;
                    proxyCount++;
                    continue;
                } else {
                    // 这是其他代理，不跳过
                    skipLines = false;
                    proxyCount++;
                    newLines.push(lines[i]);
                }
            } else if (skipLines) {
                // 如果正在跳过，检查是否遇到下一个代理或文件结束
                if (line.startsWith('[') && line !== '[[proxies]]') {
                    // 遇到其他配置段，停止跳过
                    skipLines = false;
                    newLines.push(lines[i]);
                } else if (i === lines.length - 1) {
                    // 文件结束，不添加这行
                    continue;
                }
                // 否则继续跳过这行
            } else {
                // 不在跳过模式，正常添加行
                newLines.push(lines[i]);
            }
        }

        // 写入新文件
        fs.writeFileSync(TOML_FILE_PATH, newLines.join('\n'), 'utf8');

        res.json({
            success: true,
            message: `代理 "${deletedProxy.name}" 删除成功`
        });
    } catch (error) {
        console.error('删除代理错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API路由：添加新代理
app.post('/api/proxies', async (req, res) => {
    try {
        const { name, type, localIP, localPort, remotePort } = req.body;

        // 验证必填字段
        if (!name || !type || !localIP || !localPort || !remotePort) {
            return res.status(400).json({
                success: false,
                error: '所有字段都是必填的'
            });
        }

        // 写入文件
        const success = writeTomlFile(req.body);

        if (success) {
            res.json({
                success: true,
                message: '代理配置添加成功'
            });
        } else {
            res.status(500).json({
                success: false,
                error: '写入文件失败'
            });
        }
    } catch (error) {
        console.error('添加代理错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API路由：获取代理配置
app.get('/api/proxies', (req, res) => {
    try {
        // 检查文件是否存在
        if (!fs.existsSync(TOML_FILE_PATH)) {
            return res.status(404).json({
                success: false,
                error: `文件不存在: ${TOML_FILE_PATH}`
            });
        }

        // 读取文件
        const content = fs.readFileSync(TOML_FILE_PATH, 'utf8');

        // 解析TOML
        const data = parseToml(content);

        res.json({
            success: true,
            data: data,
            filePath: TOML_FILE_PATH,
            lastModified: fs.statSync(TOML_FILE_PATH).mtime
        });
    } catch (error) {
        console.error('读取文件错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 重新生成完整的TOML文件
function generateTomlFile(serverInfo, proxies) {
    let content = '';

    // 添加服务器配置
    content += `serverAddr = "${serverInfo.serverAddr}"\n`;
    content += `serverPort = ${serverInfo.serverPort}\n\n`;

    // 添加认证配置
    if (serverInfo.authMethod === 'token' && serverInfo.token) {
        content += '\n[auth]\n';
        content += `method = "${serverInfo.authMethod}"\n`;
        content += `token = "${serverInfo.token}"\n\n`;
    }

    // 添加代理配置
    proxies.forEach(proxy => {
        content += '\n[[proxies]]\n';
        content += `name = "${proxy.name}"\n`;
        content += `type = "${proxy.type}"\n`;
        content += `localIP = "${proxy.localIP}"\n`;
        content += `localPort = ${proxy.localPort}\n`;
        content += `remotePort = ${proxy.remotePort}\n`;
    });

    return content;
}

// API路由：更新服务器配置
app.put('/api/server-config', async (req, res) => {
    try {
        const { serverAddr, serverPort, authMethod, token } = req.body;

        // 验证必填字段
        if (!serverAddr || !serverPort) {
            return res.status(400).json({
                success: false,
                error: '服务器地址和端口是必填的'
            });
        }

        if (authMethod === 'token' && !token) {
            return res.status(400).json({
                success: false,
                error: '选择Token认证时必须提供Token'
            });
        }

        // 读取现有配置
        const content = fs.readFileSync(TOML_FILE_PATH, 'utf8');
        const data = parseToml(content);

        // 更新服务器配置
        const newServerInfo = {
            serverAddr,
            serverPort,
            authMethod: authMethod || 'none',
            token: authMethod === 'token' ? token : ''
        };

        // 重新生成TOML文件
        const newContent = generateTomlFile(newServerInfo, data.proxies);
        fs.writeFileSync(TOML_FILE_PATH, newContent, 'utf8');

        res.json({
            success: true,
            message: '服务器配置更新成功'
        });
    } catch (error) {
        console.error('更新服务器配置错误:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API路由：连接到frps服务器
app.post('/api/connect-frps', async (req, res) => {
    try {
        // 获取frpc.exe的路径（与frpc.toml在同一目录）
        const frpcPath = path.join(path.dirname(TOML_FILE_PATH), 'frpc.exe');
        const configPath = TOML_FILE_PATH;

        // 检查frpc.exe是否存在
        if (!fs.existsSync(frpcPath)) {
            return res.status(400).json({
                success: false,
                error: `frpc.exe 文件不存在: ${frpcPath}`
            });
        }

        // 检查配置文件是否存在
        if (!fs.existsSync(configPath)) {
            return res.status(400).json({
                success: false,
                error: `配置文件不存在: ${configPath}`
            });
        }

        // 如果已有进程在运行，先终止它
        if (currentFrpcProcess) {
            console.log('终止现有的frpc进程');
            currentFrpcProcess.kill('SIGTERM');
            currentFrpcProcess = null;
        }

        // 清空日志
        frpcLogs = [];

        console.log('正在启动FRP客户端进程:', frpcPath);

        // 使用PowerShell启动frpc进程，这样可以更好地处理Windows环境
        const psCommand = `& "${frpcPath}" -c "${configPath}"`;
        const cmdArgs = [
            '-NoProfile',
            '-ExecutionPolicy', 'Bypass',
            '-Command', psCommand
        ];

        currentFrpcProcess = spawn('powershell', cmdArgs, {
            cwd: path.dirname(frpcPath),
            stdio: ['pipe', 'pipe', 'pipe'],
            shell: false,
            windowsHide: true
        });

        let initialOutput = '';
        let hasConnected = false;

        // 监听stdout输出
        currentFrpcProcess.stdout.on('data', (data) => {
            const output = data.toString();
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] ${output}`;

            frpcLogs.push(logEntry);

            // 保持最近的100条日志
            if (frpcLogs.length > 100) {
                frpcLogs.shift();
            }

            console.log('FRPC STDOUT:', output.trim());

            // 检查是否包含连接成功的标志
            if (output.includes('login to server success') ||
                output.includes('start proxy success')) {
                hasConnected = true;
            }
        });

        // 监听stderr输出
        currentFrpcProcess.stderr.on('data', (data) => {
            const output = data.toString();
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] ERROR: ${output}`;

            frpcLogs.push(logEntry);

            // 保持最近的100条日志
            if (frpcLogs.length > 100) {
                frpcLogs.shift();
            }

            console.log('FRPC STDERR:', output.trim());
        });

        // 监听进程退出
        currentFrpcProcess.on('close', (code) => {
            console.log(`frpc进程已退出，退出代码: ${code}`);
            const timestamp = new Date().toISOString();
            frpcLogs.push(`[${timestamp}] 进程已退出，退出代码: ${code}`);
            currentFrpcProcess = null;
        });

        // 监听进程错误
        currentFrpcProcess.on('error', (error) => {
            console.error('frpc进程错误:', error);
            const timestamp = new Date().toISOString();
            frpcLogs.push(`[${timestamp}] 进程错误: ${error.message}`);
        });

        // 立即返回成功响应，表示进程已启动
        res.json({
            success: true,
            connected: true,
            output: '正在启动FRP客户端，请稍候...',
            message: '进程已启动，日志将实时更新',
            frpcPath: frpcPath,
            configPath: configPath,
            pid: currentFrpcProcess.pid
        });

    } catch (error) {
        console.error('连接frps时出错:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API路由：检查系统中的frpc进程状态
app.get('/api/frpc-system-status', (req, res) => {
    try {
        // 使用tasklist命令检查frpc进程
        exec('tasklist /FI "IMAGENAME eq frpc.exe"', (error, stdout, stderr) => {
            if (error) {
                console.error('检查frpc进程时出错:', error);
                return res.json({
                    success: true,
                    isRunning: false,
                    processCount: 0,
                    message: '无法检查进程状态'
                });
            }

            // 解析输出，检查是否包含frpc.exe
            const lines = stdout.split('\n');
            const frpcProcesses = lines.filter(line => line.includes('frpc.exe'));

            const isRunning = frpcProcesses.length > 0;
            const processCount = frpcProcesses.length;

            res.json({
                success: true,
                isRunning: isRunning,
                processCount: processCount,
                message: isRunning ? `发现 ${processCount} 个frpc进程正在运行` : 'frpc进程未运行',
                processes: frpcProcesses.map(line => line.trim()).filter(line => line)
            });
        });
    } catch (error) {
        console.error('检查frpc进程状态时出错:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// API路由：获取实时日志
app.get('/api/frpc-logs', (req, res) => {
    res.json({
        success: true,
        logs: frpcLogs,
        isRunning: currentFrpcProcess !== null,
        pid: currentFrpcProcess ? currentFrpcProcess.pid : null
    });
});

// API路由：停止frpc进程
app.post('/api/stop-frpc', (req, res) => {
    try {
        if (currentFrpcProcess) {
            console.log('正在停止frpc进程');
            currentFrpcProcess.kill('SIGTERM');
            currentFrpcProcess = null;

            const timestamp = new Date().toISOString();
            frpcLogs.push(`[${timestamp}] 用户手动停止进程`);

            res.json({
                success: true,
                message: 'frpc进程已停止'
            });
        } else {
            res.json({
                success: false,
                message: '没有正在运行的frpc进程'
            });
        }
    } catch (error) {
        console.error('停止frpc进程时出错:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

// 主页路由
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
    console.log(`FRP Proxy Viewer 服务器运行在 http://localhost:${PORT}`);
    console.log(`TOML文件路径: ${TOML_FILE_PATH}`);
});