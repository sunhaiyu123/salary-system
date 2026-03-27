-- 薪资查询系统 - 数据库索引优化脚本
-- 执行前请确认 MySQL 已连接：mysql -u root -pGczx2018@3 a8v5

-- =====================================================
-- 第一步：检查现有索引
-- =====================================================
SHOW INDEX FROM hr_properties_repositories;
SHOW INDEX FROM org_member;
SHOW INDEX FROM hr_properties_labels;
SHOW INDEX FROM hr_pages;

-- =====================================================
-- 第二步：添加优化索引（不会删除现有数据）
-- =====================================================

-- 1. 核心表联合索引 - 加速主查询
ALTER TABLE hr_properties_repositories 
ADD INDEX idx_member_property_time (member_id, property_id, createtime);

-- 2. 成员姓名索引 - 加速模糊匹配
ALTER TABLE org_member 
ADD INDEX idx_name (name);

-- 3. 属性标签索引 - 加速 JOIN
ALTER TABLE hr_properties_labels 
ADD INDEX idx_property_language (property_id, LANGUAGE);

-- 4. 页面 ID 索引
ALTER TABLE hr_pages 
ADD INDEX idx_id (ID);

-- =====================================================
-- 第三步：验证索引创建成功
-- =====================================================
SHOW INDEX FROM hr_properties_repositories WHERE Key_name = 'idx_member_property_time';
SHOW INDEX FROM org_member WHERE Key_name = 'idx_name';
SHOW INDEX FROM hr_properties_labels WHERE Key_name = 'idx_property_language';
SHOW INDEX FROM hr_pages WHERE Key_name = 'idx_id';

-- 完成！
SELECT '✅ 索引优化完成' AS status;
