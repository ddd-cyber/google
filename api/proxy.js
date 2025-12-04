const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = (req, res) => {
    // 从查询参数中获取目标URL
    const url = req.url || '';
    const queryIndex = url.indexOf('?');
    
    let target = 'https://www.google.com'; // 默认目标
    
    if (queryIndex !== -1) {
        const queryString = url.substring(queryIndex + 1);
        const params = new URLSearchParams(queryString);
        const targetParam = params.get('target');
        
        if (targetParam) {
            try {
                const decodedTarget = decodeURIComponent(targetParam);
                // 验证URL格式
                if (decodedTarget.startsWith('http://') || decodedTarget.startsWith('https://')) {
                    target = decodedTarget;
                } else {
                    target = 'https://' + decodedTarget;
                }
            } catch (error) {
                console.error('URL解析错误:', error);
            }
        }
    }
    
    // 提取目标网站的基础URL
    let baseTarget;
    try {
        const targetUrl = new URL(target);
        baseTarget = targetUrl.origin;
    } catch (error) {
        // 如果URL无效，使用默认
        baseTarget = 'https://www.google.com';
        target = 'https://www.google.com';
    }
    
    console.log(`代理请求: ${req.url} -> ${baseTarget}`);
    
    // 配置代理中间件
    const proxyOptions = {
        target: baseTarget,
        changeOrigin: true,
        secure: false,
        followRedirects: true,
        
        // 设置请求头
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
            'Accept-Encoding': 'gzip, deflate, br',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Cache-Control': 'max-age=0'
        },
        
        onProxyReq: (proxyReq, req, res) => {
            // 移除可能暴露代理的头部
            proxyReq.removeHeader('x-forwarded-for');
            proxyReq.removeHeader('x-forwarded-host');
            proxyReq.removeHeader('x-vercel-id');
        },
        
        onProxyRes: (proxyRes, req, res) => {
            // 删除可能阻止在iframe中显示的安全头
            delete proxyRes.headers['content-security-policy'];
            delete proxyRes.headers['x-frame-options'];
            
            // 允许跨域
            proxyRes.headers['access-control-allow-origin'] = '*';
        },
        
        onError: (err, req, res) => {
            console.error('代理错误:', err);
            res.writeHead(500, { 'Content-Type': 'text/html' });
            res.end(`
                <html>
                    <body style="font-family: Arial; padding: 40px; text-align: center;">
                        <h1 style="color: #e74c3c;">代理错误</h1>
                        <p>无法访问目标网站: ${target}</p>
                        <p>错误信息: ${err.message}</p>
                        <p><a href="/">返回首页</a></p>
                    </body>
                </html>
            `);
        }
    };
    
    // 创建并执行代理
    const proxy = createProxyMiddleware(proxyOptions);
    proxy(req, res);
};
