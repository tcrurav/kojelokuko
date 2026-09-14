require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const config = { 
    dialect: 'mysql', 
    host: process.env.DB_HOST || '127.0.0.1', 
    port: Number(process.env.DB_PORT || 3306), 
    database: process.env.MYSQL_DATABASE || 'pair_game', 
    username: process.env.MYSQL_USER || 'pair_game', password: process.env.MYSQL_PASSWORD, logging: false, seederStorage: 'sequelize' };
module.exports = { development: config, test: config, production: config };
