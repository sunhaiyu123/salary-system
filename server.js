import { fileURLToPath } from 'url';
import path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

import express from 'express';
import mysql from 'mysql2/promise';
import cors from 'cors';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());

// MySQL 连接池配置
const dbConfig = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
};

// API 路由：查询薪资数据
app.get('/api/salary', async (req, res) => {
  const { name, year, month } = req.query;

  console.log(`📊 收到查询请求：姓名=${name}, 年份=${year}, 月份=${month}`);

  if (!name || !year || !month) {
    console.error('❌ 缺少必要参数');
    return res.status(400).json({
      success: false,
      message: '缺少必要参数：name, year, month'
    });
  }

  let connection;

  try {
    // 创建数据库连接
    console.log('🔌 正在连接 MySQL 数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 构建查询条件
    const datePattern = `${year}-${month}%`;

    // 查询 SQL - 优化版（减少子查询，提高性能）
    const query = `
      SELECT
        n.name,
        ROUND(p.f2 / (p_union.union_fee * 1.0 / 10), 2) AS real_amount,
        ps.property_label_value,
        pag.PAGE_NAME AS category,
        p.ORDERING
      FROM org_member n
      INNER JOIN hr_properties_repositories p ON p.member_id = n.id
      LEFT JOIN hr_pages pag ON p.PAGE_ID = pag.ID
      LEFT JOIN hr_properties_labels ps ON p.property_id = ps.property_id
      INNER JOIN (
        SELECT member_id, f2 AS union_fee
        FROM hr_properties_repositories
        WHERE property_id = '-1853916752288068131'
          AND createtime LIKE ?
      ) p_union ON n.id = p_union.member_id
      WHERE ps.LANGUAGE = 'zh_CN'
        AND p.createtime LIKE ?
        AND n.name = ?
      ORDER BY pag.PAGE_NAME, p.ORDERING;
    `;

    console.log('🔍 执行 SQL 查询...');
    const startTime = Date.now();
    const [results] = await connection.execute(query, [datePattern, datePattern, name]);
    const queryTime = Date.now() - startTime;

    console.log(`📊 查询返回 ${results.length} 条记录，耗时 ${queryTime}ms`);

    if (results.length === 0) {
      console.warn(`⚠️ 未找到数据：${name} 在 ${year}-${month}`);
      return res.status(404).json({
        success: false,
        message: `未找到 ${name} 在 ${year}年${parseInt(month)}月的薪资数据`
      });
    }

    // 数据处理：按类别分组
    console.log('📑 处理数据...');
    const groupedData = groupByCategory(results);
    console.log(`✅ 数据处理完成，共 ${groupedData.length} 个分类`);

    res.json({
      success: true,
      data: {
        name: results[0]?.name || name,
        year: year,
        month: month,
        categories: groupedData
      }
    });

  } catch (error) {
    console.error('❌ 查询错误:', error.message);
    console.error('错误详情:', error);

    res.status(500).json({
      success: false,
      message: '服务器内部错误：' + error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });

  } finally {
    if (connection) {
      console.log('🔌 关闭数据库连接');
      await connection.end();
    }
  }
});

// 将查询结果按类别分组（保留所有原始记录）
function groupByCategory(data) {
  const categoryMap = new Map();

  // 定义标准类别顺序
  const categoryOrder = [
    '工资构成', '福利', '个人缴纳', '其他信息', '应发合计'
  ];

  data.forEach(row => {
    if (!row.category || !row.real_amount) return;

    if (!categoryMap.has(row.category)) {
      categoryMap.set(row.category, []);
    }

    const item = {
      name: row.property_label_value,
      amount: parseFloat(row.real_amount),
      isTotal: ['合计', '小计'].some(keyword => row.property_label_value.includes(keyword)),
      highlight: row.property_label_value === '工会会费' || row.property_label_value === '入卡金额'
    };

    // 保留所有记录，包括同名项（每条单独显示）
    categoryMap.get(row.category).push(item);
  });

  // 按标准顺序返回，保持未分类的在末尾
  const result = [];

  // 先添加标准类别
  categoryOrder.forEach(category => {
    if (categoryMap.has(category)) {
      result.push({
        category: category,
        items: categoryMap.get(category)
      });
    }
  });

  // 再添加其他未分类的
  categoryMap.forEach((items, category) => {
    if (!categoryOrder.includes(category)) {
      result.push({
        category: category,
        items: items
      });
    }
  });

  return result;
}

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '薪资查询 API 服务正常运行',
    timestamp: new Date().toISOString()
  });
});

// 🔥 年薪统计接口（修复版 - 逐月去重后计算）
app.get('/api/annual-salary', async (req, res) => {
  const { name, year } = req.query;

  console.log(`📊 收到年薪统计请求：姓名=${name}, 年份=${year}`);

  if (!name || !year) {
    return res.status(400).json({ success: false, message: '缺少必要参数：name, year' });
  }

  let connection;
  try {
    console.log('🔌 正在连接 MySQL 数据库...');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ 数据库连接成功');

    // 第一步：获取所有有数据的月份列表
    const monthsQuery = `
      SELECT DISTINCT DATE_FORMAT(createtime, '%Y-%m') as month
      FROM hr_properties_repositories p
      INNER JOIN org_member n ON p.member_id = n.id
      LEFT JOIN hr_pages pag ON p.PAGE_ID = pag.ID
      LEFT JOIN hr_properties_labels ps ON p.property_id = ps.property_id
      WHERE ps.LANGUAGE = 'zh_CN'
        AND pag.PAGE_NAME = '应发合计'
        AND n.name = ?
        AND YEAR(p.createtime) = ?
      ORDER BY month;
    `;

    const [monthsData] = await connection.execute(monthsQuery, [name, year]);
    const months = monthsData.map(row => row.month);
    
    console.log(`📅 全年"应发合计"月份：${months.join(', ')}`);

    if (months.length === 0) {
      console.warn(`⚠️ 未找到数据：${name} 在 ${year}年`);
      return res.status(404).json({ success: false, message: `未找到 ${name} 在 ${year}年的薪资数据` });
    }

    // 第二步：逐月查询应发合计的 f2 总和（累加同月的所有记录）
    const monthlyF2Query = `
      SELECT SUM(f2) as total_f2
      FROM hr_properties_repositories p
      INNER JOIN org_member n ON p.member_id = n.id
      LEFT JOIN hr_pages pag ON p.PAGE_ID = pag.ID
      LEFT JOIN hr_properties_labels ps ON p.property_id = ps.property_id
      WHERE ps.LANGUAGE = 'zh_CN'
        AND pag.PAGE_NAME = '应发合计'
        AND n.name = ?
        AND p.createtime LIKE ?;
    `;

    const monthlyRecords = [];
    for (const month of months) {
      const [result] = await connection.execute(monthlyF2Query, [name, `${month}%`]);
      if (result.length > 0 && result[0].total_f2) {
        const totalF2 = parseFloat(result[0].total_f2);
        monthlyRecords.push({ month, f2: totalF2 });
      }
    }

    // 第二步：查询该员工的工会会费（取该年任意一个月的）
    const unionFeeQuery = `
      SELECT f2 as union_fee
      FROM hr_properties_repositories p
      INNER JOIN org_member n ON p.member_id = n.id
      WHERE p.property_id = '-1853916752288068131'
        AND n.name = ?
        AND YEAR(p.createtime) = ?
      LIMIT 1;
    `;

    const [unionFeeData] = await connection.execute(unionFeeQuery, [name, year]);
    
    if (unionFeeData.length === 0 || unionFeeData[0].union_fee <= 0) {
      console.warn(`⚠️ 未找到工会会费数据：${name} 在 ${year}年`);
      return res.status(500).json({ success: false, message: '未找到工会会费，无法计算薪资' });
    }

    const unionFee = parseFloat(unionFeeData[0].union_fee);
    console.log(`💰 工会会费：${unionFee.toFixed(2)}元`);

    // 第三步：逐月计算 real_amount = f2 / (工会会费/10) 然后累加
    let annualTotal = 0;
    
    console.log(`📊 系数计算：工会会费 ${unionFee.toFixed(2)} ÷ 10 = ${(unionFee / 10).toFixed(2)}`);

    monthlyRecords.forEach(row => {
      const f2 = parseFloat(row.f2);
      const realAmount = ROUND(f2 / (unionFee / 10), 2); // 实际应发 = f2 / (工会会费/10)
      annualTotal += realAmount;
      console.log(`  → ${row.month}: f2=${f2.toFixed(2)} ÷ ${(unionFee/10).toFixed(2)} = ${realAmount.toFixed(2)}元`);
    });

    const monthsWithData = monthlyRecords.length;
    
    console.log(`✅ ${name} ${year}年应发合计：${annualTotal.toFixed(2)}元（${monthsWithData}个月有数据）`);

    res.json({
      success: true,
      data: {
        name: name,
        year: parseInt(year),
        annualTotal: annualTotal,
        monthsWithData: monthsWithData,
        unionFee: unionFee,
        coefficient: unionFee / 10.0
      }
    });

  } catch (error) {
    console.error('❌ 年薪查询错误:', error.message);
    res.status(500).json({ success: false, message: '服务器内部错误：' + error.message });
  } finally {
    if (connection) {
      console.log('🔌 关闭数据库连接');
      await connection.end();
    }
  }
});

// 辅助函数（四舍五入到2位小数）
function ROUND(num, decimals) {
  return Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
}

// 🆕 添加首页路由和静态文件服务（必须在 app.listen 之前！）
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '薪资查询 API 服务正常运行',
    timestamp: new Date().toISOString()
  });
});

// 🔥 静态文件服务（放在所有路由之后）
app.use(express.static(__dirname));

// 启动服务器
app.listen(port, () => {
  console.log(`🚀 薪资查询 API 服务已启动`);
  console.log(`📡 监听端口：${port}`);
  console.log(`🔗 API 地址：http://localhost:${port}/api/salary`);
  console.log(`💰 年薪统计：http://localhost:${port}/api/annual-salary`);
  console.log(`🏥 健康检查：http://localhost:${port}/api/health`);
});
