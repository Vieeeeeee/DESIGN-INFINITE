/**
 * PM2 Ecosystem Configuration
 * 固定环境变量，确保重启后配置不丢失
 * 
 * 使用方式：
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 */
module.exports = {
    apps: [{
        name: 'generator-api',
        script: 'index.js',
        cwd: '/www/generator/server',
        instances: 1,
        exec_mode: 'fork',
        watch: false,
        max_memory_restart: '500M',

        // 环境变量
        env: {
            NODE_ENV: 'production',
            PORT: 3001,

            // Vertex AI 配置
            GOOGLE_APPLICATION_CREDENTIALS: '/root/gcp/key.json',
            VERTEX_AI_PROJECT: 'vibe-design',
            VERTEX_AI_REGION: 'global',
            VERTEX_AI_MODEL: 'gemini-3-pro-image-preview',
        },

        // 日志配置
        error_file: '/root/.pm2/logs/generator-api-error.log',
        out_file: '/root/.pm2/logs/generator-api-out.log',
        log_date_format: 'YYYY-MM-DD HH:mm:ss',
        merge_logs: true,
    }]
};
