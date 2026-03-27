const { spawn } = require('child_process');
const fs = require('fs');

console.log('🚀 开始导入 SQL 文件到本地 MySQL...');
console.log('📁 文件：D:\\a8v5_backup_20260312_222256.sql');
console.log('💾 目标：localhost/a8v5');

const mysql = spawn('mysql', [
    '-h', '127.0.0.1',
    '-u', 'root',
    '-pgxsfasdf',
    'a8v5'
]);

const readStream = fs.createReadStream('D:\\a8v5_backup_20260312_222256.sql');

readStream.on('error', (err) => {
    console.error('❌ 读取文件失败:', err.message);
});

mysql.stdin.pipe(readStream);

mysql.stdout.on('data', (data) => {
    process.stdout.write(data);
});

mysql.stderr.on('data', (data) => {
    process.stderr.write(data);
});

mysql.on('close', (code) => {
    if (code === 0) {
        console.log('\n✅ SQL 导入完成！数据库已更新');
    } else {
        console.error(`\n❌ MySQL 进程退出，代码：${code}`);
    }
});
