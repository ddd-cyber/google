const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = async (req, res) => {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }
  
  // 从URL获取目标地址
  const { url } = req;
  let targetUrl = 'https://www.google.com';
  
  // 解析target参数
  if (url.includes('?')) {
    const queryString = url.split('?')[1];
    const params = new URLSearchParams(queryString);
    const targetParam = params.get('target');
    
    if (targetParam) {
      try {
        targetUrl = decodeURIComponent(targetParam);
        // 确保URL有协议头
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          targetUrl = 'https://' + targetUrl;
        }
      } catch (error) {
        console.error('解析URL错误:', error);
      }
    }
  }
  
  console.log(`代理到: ${targetUrl}`);
  
  // 获取目标基础URL
  let baseUrl;
  try {
    const urlObj = new URL(targetUrl);
    baseUrl = urlObj.origin;
  } catch (e) {
    baseUrl = 'https://www.google.com';
    targetUrl = 'https://www.google.com';
  }
  
  // 创建代理中间件
  const proxy = createProxyMiddleware({
    target: baseUrl,
    changeOrigin: true,
    secure: false,
    pathRewrite: (path) => {
      // 保持原始路径
      return path.split('?')[0];
    },
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate, br',
      'Connection': 'keep-alive'
    },
    onProxyReq: (proxyReq, req, res) => {
      // 移除代理标识头
      proxyReq.removeHeader('x-forwarded-for');
      proxyReq.removeHeader('x-forwarded-host');
    },
    onProxyRes: (proxyRes, req, res) => {
      // 删除可能阻止在iframe中显示的安全头
      delete proxyRes.headers['content-security-policy'];
      delete proxyRes.headers['x-frame-options'];
      delete proxyRes.headers['x-content-type-options'];
    },
    onError: (err, req, res) => {
      console.error('代理错误:', err);
      res.writeHead(500, { 'Content-Type': 'text/html' });
      res.end(`
        <html>
          <body style="font-family: Arial; padding: 40px;">
            <h1>代理错误</h1>
            <p>无法访问目标网站</p>
            <p>错误: ${err.message}</p>
            <p><a href="/">返回首页</a></p>
          </body>
        </html>
      `);
    }
  });
  
  return proxy(req, res);
};
