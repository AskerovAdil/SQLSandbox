-- Сотрудники: departments, employees (manager_id для self-join), salaries (оконные функции, GROUP BY, рекурсивные CTE)
CREATE TABLE departments (id int PRIMARY KEY, name text NOT NULL);
CREATE TABLE employees (
  id int PRIMARY KEY,
  name text NOT NULL,
  dept_id int REFERENCES departments (id),
  manager_id int REFERENCES employees (id),
  hired_on date NOT NULL
);
CREATE TABLE salaries (
  id int PRIMARY KEY,
  employee_id int NOT NULL REFERENCES employees (id),
  amount numeric(10, 2) NOT NULL,
  valid_from date NOT NULL
);

INSERT INTO departments VALUES (1, 'Разработка'), (2, 'Продажи'), (3, 'Маркетинг');

INSERT INTO employees VALUES
  (1, 'Елена Громова', 1, NULL, '2015-03-01'),
  (2, 'Игорь Волков', 1, 1, '2018-07-15'),
  (3, 'Анна Белова', 1, 2, '2020-01-10'),
  (4, 'Павел Орлов', 2, 1, '2019-05-20'),
  (5, 'Мария Соколова', 2, 4, '2021-09-01'),
  (6, 'Дмитрий Лебедев', 3, NULL, '2017-11-11'),
  (7, 'Ольга Новикова', NULL, 6, '2023-02-06');

INSERT INTO salaries VALUES
  (1, 1, 320000.00, '2015-03-01'),
  (2, 2, 210000.00, '2018-07-15'),
  (3, 2, 235000.00, '2021-01-01'),
  (4, 3, 180000.00, '2020-01-10'),
  (5, 4, 150000.00, '2019-05-20'),
  (6, 5, 130000.00, '2021-09-01'),
  (7, 6, 200000.00, '2017-11-11'),
  (8, 7, 110000.00, '2023-02-06');

-- @@queries
-- Примеры для тренировки. Выделите запрос и нажмите Ctrl+Enter.

-- Оконная функция: зарплата и место внутри отдела
SELECT e.name, d.name AS department, s.amount,
       rank() OVER (PARTITION BY e.dept_id ORDER BY s.amount DESC) AS place_in_dept
FROM employees e
JOIN departments d ON d.id = e.dept_id
JOIN salaries s ON s.employee_id = e.id;

-- Self-join: сотрудник и его руководитель
SELECT e.name AS employee, m.name AS manager
FROM employees e
LEFT JOIN employees m ON m.id = e.manager_id
ORDER BY e.id;

-- Агрегаты по отделам
SELECT d.name, count(e.id) AS headcount, round(avg(s.amount), 2) AS avg_salary
FROM departments d
LEFT JOIN employees e ON e.dept_id = d.id
LEFT JOIN salaries s ON s.employee_id = e.id
GROUP BY d.name
HAVING count(e.id) > 0
ORDER BY avg_salary DESC;

-- Рекурсивный CTE: вся цепочка подчинения, начиная с Елены Громовой
WITH RECURSIVE chain AS (
  SELECT id, name, manager_id, 0 AS level FROM employees WHERE id = 1
  UNION ALL
  SELECT e.id, e.name, e.manager_id, c.level + 1
  FROM employees e JOIN chain c ON e.manager_id = c.id
)
SELECT repeat('  ', level) || name AS org_chart, level FROM chain ORDER BY level, name;
