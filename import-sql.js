const { createWriteStream, createReadStream } = require('fs');
const { exec } = require('child_process');

console.log('开始导入 SQL 文件...');

const sqlFile = 'D:\\a8v5_backup_20260312_222256.sql';
const mysqlCmd = 'mysql -h 127.0.0.1 -u root -p"gxsfasdf" a8v5';

const readStream = createReadStream(sqlFile);
const mysqlProcess = exec(mysqlCmd, { maxBuffer: 1024 * 1024 * 1024 }); // 1GB buffer

readStream.pipe(mysqlProcess.stdin);

mysqlProcess.stdout.on('data', (data) => {
    console.log(`MySQL 输出：${data}`);
});

mysqlProcess.stderr.on('data', (data) => {
    console.error(`MySQL 错误：${data}`);
});

mysqlProcess.on('close', (code) => {
    if (code === 0) {
        console.log('✅ SQL 文件导入完成！');
    } else {
        console.error(`❌ MySQL 进程退出，代码：${code}`);
    }
});

readStream.on('error', (err) => {
    console.error(`❌ 读取文件失败：${err.message}`);
});
