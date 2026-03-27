-- 薪资查询系统 - 数据库索引优化脚本 V2
-- 检查并创建缺失的索引

USE a8v5;

-- ============= ================================ ========
-- 第二步：直接创建新索引（如果已存在会报错，可以先忽略）
-- ============= ================================ ========

-- 1. 核心表联合索引 - 加速主查询
ALTER TABLE hr_properties_repositories 
ADD INDEX idx_member_prop_time (member_id, property_id, createtime);

-- 2. 成员姓名索引 - 加速精确匹配  
ALTER TABLE org_member 
ADD INDEX idx_name (name);

-- 3. 属性标签索引 - 加速 JOIN
ALTER TABLE hr_properties_labels 
ADD INDEX idx_property_language (property_id, LANGUAGE);

-- ============ ================================ ========
-- 第三步：优化表（整理碎片，更新统计信息）
-- ============ ================================ ========
OPTIMIZE TABLE hr_properties_repositories;
OPTIMIZE TABLE org_member;
OPTIMIZE TABLE hr_properties_labels;
OPTIMIZE TABLE hr_pages;

-- ============= ================================ ========
-- 完成！
-- ============= ================================ ========
SELECT '✅ 索引优化完成！' AS status, 
       NOW() AS completed_at;
