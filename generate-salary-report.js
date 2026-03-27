import mysql from 'mysql2/promise';
import * as XLSX from 'xlsx';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  charset: 'utf8mb4'
};

console.log('🔌 正在连接数据库...');

try {
  const connection = await mysql.createConnection(dbConfig);
  console.log('✅ 数据库连接成功');

  // 查询所有员工 2025 年 7 月的薪资数据
  console.log('📊 正在查询全员薪资数据...');
  
  const query = `
    SELECT 
      n.name,
      ps.property_label_value,
      p.ORDERING,
      ROUND(p.f2 / (union_fee * 1.0 / 10), 2) AS real_amount,
      UNIX_TIMESTAMP(p.createtime) as create_time
    FROM hr_properties_repositories p 
    INNER JOIN org_member n ON n.id = p.member_id 
    LEFT JOIN hr_properties_labels ps ON p.property_id = ps.property_id
    INNER JOIN (
      SELECT DISTINCT member_id, f2 AS union_fee
      FROM hr_properties_repositories
      WHERE property_id = '-1853916752288068131'
    ) u ON n.id = u.member_id
    WHERE ps.LANGUAGE = 'zh_CN' 
      AND p.createtime LIKE '%2025-07%'
      AND ps.property_label_value IN ('应发合计', '入卡金额', '基础工资')
      AND p.f2 IS NOT NULL
    ORDER BY n.name, UNIX_TIMESTAMP(p.createtime), p.ORDERING;
  `;

  const [results] = await connection.execute(query);
  console.log(`📋 查询到 ${results.length} 条记录`);
  
  // 数据处理：按员工分组
  const employeeMap = new Map();
  
  results.forEach(row => {
    if (!employeeMap.has(row.name)) {
      employeeMap.set(row.name, {
        name: row.name,
        '基础工资': null,
        '应发合计': null,
        '入卡金额': null,
        '绩效工资': null,
        '绩效入卡金额': null,
        timestamps: []
      });
    }
    
    const emp = employeeMap.get(row.name);
    
    // 记录时间戳用于区分先后顺序
    if (!emp.timestamps.includes(row.create_time)) {
      emp.timestamps.push(row.create_time);
    }
    
    // 根据时间戳判断是第几次发放
    const timeIndex = emp.timestamps.indexOf(row.create_time);
    
    if (row.property_label_value === '基础工资') {
      emp['基础工资'] = row.real_amount;
    } else if (row.property_label_value === '应发合计') {
      if (timeIndex === 0 && emp['应发合计'] === null) {
        // 第一次发放 - 可能是绩效
        emp['绩效工资'] = row.real_amount;
      } else if (timeIndex > 0 || emp['应发合计'] !== null) {
        // 正常工资或最后一次
        emp['应发合计'] = row.real_amount;
      }
    } else if (row.property_label_value === '入卡金额') {
      if (timeIndex === 0 && emp['入卡金额'] === null) {
        // 第一次发放的入卡 - 绩效入卡
        emp['绩效入卡金额'] = row.real_amount;
      } else {
        emp['入卡金额'] = row.real_amount;
      }
    }
  });

  // 转换为数组并排序
  const salaryData = Array.from(employeeMap.values())
    .filter(emp => emp['基础工资'] !== null || emp['应发合计'] !== null)
    .sort((a, b) => {
      // 按应发合计降序排列
      const aTotal = (a['绩效工资'] || 0) + (a['应发合计'] || 0);
      const bTotal = (b['绩效工资'] || 0) + (b['应发合计'] || 0);
      return bTotal - aTotal;
    });

  console.log(`✅ 共 ${salaryData.length} 位员工`);

  // 生成 Excel 数据
  const excelData = salaryData.map(emp => ({
    '姓名': emp.name,
    '基础工资': emp['基础工资'] || 0,
    '应发合计': emp['应发合计'] || 0,
    '入卡金额': emp['入卡金额'] || 0,
    '绩效工资': emp['绩效工资'] || 0,
    '绩效入卡金额': emp['绩效入卡金额'] || 0,
    '全年总计': (emp['绩效工资'] || 0) + (emp['应发合计'] || 0),
    '实际到手总计': (emp['绩效入卡金额'] || 0) + (emp['入卡金额'] || 0)
  }));

  // 添加汇总行
  const summary = {
    '姓名': '📊 汇总',
    '基础工资': salaryData.reduce((sum, emp) => sum + (emp['基础工资'] || 0), 0),
    '应发合计': salaryData.reduce((sum, emp) => sum + (emp['应发合计'] || 0), 0),
    '入卡金额': salaryData.reduce((sum, emp) => sum + (emp['入卡金额'] || 0), 0),
    '绩效工资': salaryData.reduce((sum, emp) => sum + (emp['绩效工资'] || 0), 0),
    '绩效入卡金额': salaryData.reduce((sum, emp) => sum + (emp['绩效入卡金额'] || 0), 0),
    '全年总计': salaryData.reduce((sum, emp) => sum + ((emp['绩效工资'] || 0) + (emp['应发合计'] || 0)), 0),
    '实际到手总计': salaryData.reduce((sum, emp) => sum + ((emp['绩效入卡金额'] || 0) + (emp['入卡金额'] || 0)), 0)
  };

  excelData.push(summary);

  // 创建 workbook
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(excelData);

  // 设置列宽
  ws['!cols'] = [
    { wch: 15 }, // 姓名
    { wch: 12 }, // 基础工资
    { wch: 12 }, // 应发合计
    { wch: 12 }, // 入卡金额
    { wch: 12 }, // 绩效工资
    { wch: 14 }, // 绩效入卡金额
    { wch: 12 }, // 全年总计
    { wch: 14 }  // 实际到手总计
  ];

  // 添加工作表
  XLSX.utils.book_append_sheet(wb, ws, '2025 年 7 月全员薪资');

  // 生成文件名（带时间戳）
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const filename = `C:\\Users\\sunhaiyu\\.openclaw\\workspace\\salary-system\\公司全员薪资统计_2025-07_${timestamp}.xlsx`;

  // 写入文件
  XLSX.writeFile(wb, filename);
  
  console.log('\n🎉 ======== 生成完成 ========');
  console.log(`📁 文件路径：${filename}`);
  console.log(`\n📊 统计摘要:`);
  console.log(`   员工人数：${salaryData.length} 人`);
  console.log(`   总应发金额：¥${summary['全年总计'].toLocaleString('zh-CN', {minimumFractionDigits: 2})}`);
  console.log(`   总实发金额：¥${summary['实际到手总计'].toLocaleString('zh-CN', {minimumFractionDigits: 2})}`);
  console.log('\n✅ Excel 文件已生成，可以直接打开查看！');

  await connection.end();

} catch (error) {
  console.error('❌ 错误:', error.message);
  console.error(error.stack);
}
