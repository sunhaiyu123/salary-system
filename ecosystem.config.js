module.exports = {
  apps: [{
    name: 'salary-query',           // 应用名称
    script: 'server.js',            // 启动脚本
    cwd: '/opt/salary-system',      // 工作目录（Linux 上）
    instances: 1,                   // 实例数量
    exec_mode: 'fork',              // 运行模式
    autorestart: true,              // 崩溃后自动重启
    watch: false,                   // 不监控文件变化（生产环境关闭）
    max_memory_restart: '1G',       // 内存超过 1GB 自动重启
    error_file: '/var/log/salary/error.log',   // 错误日志
    out_file: '/var/log/salary/out.log',       // 输出日志
    log_date_format: "YYYY-MM-DD HH:mm:ss",    // 日志时间格式
    
    env: {
      NODE_ENV: 'production',       # 生产环境
      PORT: 3000                    # 端口号
    },
    
    env_production: {
      NODE_ENV: 'production'
    }
  }]
}
