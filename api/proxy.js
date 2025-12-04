const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = (req, res) => {
    // 处理根路径请求 - 直接返回，让Vercel返回index.html
    if (req.url === '/' || req.url === '/index.html') {
        // 返回一个简单的重定向或让Vercel处理
        res.writeHead(302, {
            'Location': '/'
        });
        res.end();
        return;
    }
    
    // ... 原有的代理逻辑继续
    let target = "https://www.google.com";
    // ... 其他代码
};
const { createProxyMiddleware } = require('http-proxy-middleware');

// 通用的网络代理中间件
const createUniversalProxy = (req, res) => {
    // 获取请求的原始URL
    const fullUrl = req.url || '';
    
    // 解析URL参数
    const parseQuery = (url) => {
        try {
            // 简单解析查询参数
            const queryStart = url.indexOf('?');
            if (queryStart === -1) return { target: null };
            
            const queryString = url.substring(queryStart + 1);
            const params = new URLSearchParams(queryString);
            return {
                target: params.get('target'),
                originalPath: url.substring(0, queryStart) || '/'
            };
        } catch (error) {
            console.error('解析URL参数错误:', error);
            return { target: null, originalPath: url };
        }
    };

    const { target, originalPath } = parseQuery(fullUrl);
    
    // 如果没有target参数，直接返回（显示首页）
    if (!target) {
        // 这里可以返回一个简单的错误页面，或者让Vercel返回静态文件
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>代理服务器</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; text-align: center; }
                    h1 { color: #333; }
                    p { color: #666; }
                    a { color: #0070f3; text-decoration: none; }
                </style>
            </head>
            <body>
                <h1>代理服务器正在运行</h1>
                <p>请在URL中添加?target=参数来使用代理</p>
                <p>例如：/?target=https://example.com</p>
                <p>或者访问 <a href="/">主页</a> 使用图形界面</p>
            </body>
            </html>
        `);
        return;
    }

    // 解码目标URL
    let targetUrl;
    try {
        targetUrl = decodeURIComponent(target);
        
        // 验证URL格式
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }
        
        // 创建URL对象以提取基础URL
        const targetObj = new URL(targetUrl);
        const baseTarget = targetObj.origin; // 获取基础URL（协议+域名+端口）
        
        console.log(`代理请求: ${originalPath} -> ${baseTarget}`);
        
        // 设置请求头，模拟真实浏览器
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Cache-Control': 'max-age=0'
        };

        // 复制原始请求头
        for (const [key, value] of Object.entries(req.headers)) {
            if (key.toLowerCase() === 'host') continue;
            if (key.toLowerCase() === 'referer') continue;
            if (key.toLowerCase() === 'origin') continue;
            headers[key] = value;
        }

        // 设置代理中间件
        const proxyMiddleware = createProxyMiddleware({
            target: baseTarget,
            changeOrigin: true,
            secure: false, // 允许自签名证书
            followRedirects: true,
            autoRewrite: true,
            protocolRewrite: 'https',
            headers: headers,
            pathRewrite: (path) => {
                // 将请求路径重写为相对于目标URL的路径
                const fullPath = targetObj.pathname + targetObj.search + targetObj.hash;
                if (originalPath === '/' && fullPath !== '/') {
                    return fullPath;
                }
                return originalPath;
            },
            onProxyReq: (proxyReq, req, res) => {
                // 移除可能暴露代理的头部
                proxyReq.removeHeader('x-forwarded-for');
                proxyReq.removeHeader('x-forwarded-host');
                proxyReq.removeHeader('x-vercel-id');
                proxyReq.removeHeader('via');
                
                // 添加Referer
                if (!proxyReq.hasHeader('Referer')) {
                    proxyReq.setHeader('Referer', baseTarget);
                }
                
                // 添加Origin
                if (!proxyReq.hasHeader('Origin')) {
                    proxyReq.setHeader('Origin', baseTarget);
                }
                
                // 如果是POST请求，复制请求体
                if (req.body) {
                    const bodyData = JSON.stringify(req.body);
                    proxyReq.setHeader('Content-Type', 'application/json');
                    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                    proxyReq.write(bodyData);
                }
            },
            onProxyRes: (proxyRes, req, res) => {
                // 删除可能阻止代理工作的安全头
                const headersToRemove = [
                    'content-security-policy',
                    'content-security-policy-report-only',
                    'x-frame-options',
                    'x-content-type-options',
                    'strict-transport-security'
                ];
                
                headersToRemove.forEach(header => {
                    delete proxyRes.headers[header];
                });
                
                // 允许跨域
                proxyRes.headers['access-control-allow-origin'] = '*';
                proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
                proxyRes.headers['access-control-allow-headers'] = '*';
                
                // 处理重定向
                if (proxyRes.headers.location) {
                    const location = proxyRes.headers.location;
                    // 将重定向URL重新编码为代理URL
                    const encodedLocation = encodeURIComponent(location);
                    proxyRes.headers.location = `/?target=${encodedLocation}`;
                }
                
                // 设置缓存控制
                proxyRes.headers['cache-control'] = 'no-cache, no-store, must-revalidate';
            },
            onError: (err, req, res) => {
                console.error('代理错误:', err);
                res.writeHead(500, {
                    'Content-Type': 'text/html'
                });
                res.end(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>代理错误</title>
                        <style>
                            body { font-family: Arial, sans-serif; padding: 40px; text-align: center; }
                            h1 { color: #e74c3c; }
                            .error-details { 
                                background: #f8f9fa; 
                                padding: 20px; 
                                margin: 20px 0; 
                                border-radius: 5px; 
                                text-align: left; 
                                max-width: 600px; 
                                margin-left: auto; 
                                margin-right: auto; 
                            }
                            code { background: #e9ecef; padding: 2px 5px; border-radius: 3px; }
                        </style>
                    </head>
                    <body>
                        <h1>代理错误</h1>
                        <p>无法访问目标网站: <code>${targetUrl}</code></p>
                        <div class="error-details">
                            <strong>错误信息:</strong><br>
                            <code>${err.message}</code>
                        </div>
                        <p><a href="/">返回主页</a> | <a href="javascript:history.back()">返回上一页</a></p>
                    </body>
                    </html>
                `);
            }
        });

        // 执行代理
        proxyMiddleware(req, res);
        
    } catch (error) {
        console.error('代理配置错误:', error);
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>URL格式错误</title>
            </head>
            <body>
                <h1>URL格式错误</h1>
                <p>无法解析目标URL: ${target}</p>
                <p>错误信息: ${error.message}</p>
                <p><a href="/">返回主页</a></p>
            </body>
            </html>
        `);
    }
};

// 导出中间件
module.exports = (req, res) => {
    // 设置CORS头，允许所有来源访问
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    
    // 处理预检请求
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }
    
    // 执行代理
    createUniversalProxy(req, res);
};
