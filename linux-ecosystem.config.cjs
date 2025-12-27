module.exports = {
    apps: [
        {
            name: "attendance-api",
            script: "./attendance-server",
            env: {
                NODE_ENV: "production",
                DB_HOST: "localhost",
                DB_PORT: "5433",
                DB_USER: "attendance",
                DB_PASSWORD: "attendance_secret",
                DB_NAME: "attendance_db",
                REDIS_HOST: "localhost",
                REDIS_PORT: "6380",
                JWT_SECRET: "your-super-secret-jwt-key-change-in-production",
                PORT: "8080"
            }
        },
        {
            name: "attendance-web",
            script: "serve",
            env: {
                PM2_SERVE_PATH: "/home/rus/Code/attendance-system/web/dist",
                PM2_SERVE_PORT: 3000,
                PM2_SERVE_SPA: "true",
                PM2_SERVE_HOMEPAGE: "/index.html"
            }
        }
    ]
};
