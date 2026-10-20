-- Интернет-магазин: customers, products, orders, order_items (JOIN-ы, агрегаты, подзапросы)
CREATE TABLE customers (id int PRIMARY KEY, name text NOT NULL, city text, registered_on date NOT NULL);
CREATE TABLE products (id int PRIMARY KEY, title text NOT NULL, category text NOT NULL, price numeric(10, 2) NOT NULL);
CREATE TABLE orders (
  id int PRIMARY KEY,
  customer_id int NOT NULL REFERENCES customers (id),
  ordered_at timestamp NOT NULL,
  status text NOT NULL
);
CREATE TABLE order_items (
  order_id int NOT NULL REFERENCES orders (id),
  product_id int NOT NULL REFERENCES products (id),
  quantity int NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

INSERT INTO customers VALUES
  (1, 'Саша Ким', 'Москва', '2022-01-05'),
  (2, 'Лена Фёдорова', 'Казань', '2022-03-18'),
  (3, 'Роман Тихонов', 'Москва', '2023-06-30'),
  (4, 'Надежда Усова', 'Пермь', '2024-02-14'),
  (5, 'Тимур Аббасов', NULL, '2024-08-01');

INSERT INTO products VALUES
  (1, 'Клавиатура', 'Периферия', 4500.00),
  (2, 'Мышь', 'Периферия', 1900.00),
  (3, 'Монитор 27"', 'Экраны', 32000.00),
  (4, 'Наушники', 'Аудио', 6400.00),
  (5, 'Колонки', 'Аудио', 8900.00),
  (6, 'Кабель USB-C', 'Аксессуары', 650.00);

INSERT INTO orders VALUES
  (1, 1, '2024-01-10 12:30', 'delivered'),
  (2, 2, '2024-02-02 09:15', 'delivered'),
  (3, 1, '2024-03-21 18:40', 'cancelled'),
  (4, 3, '2024-04-05 11:00', 'delivered'),
  (5, 4, '2024-05-17 20:05', 'shipped'),
  (6, 3, '2024-06-01 08:45', 'delivered');

INSERT INTO order_items VALUES
  (1, 1, 1), (1, 2, 1), (2, 3, 1), (3, 4, 2),
  (4, 5, 1), (4, 6, 3), (5, 3, 1), (5, 2, 2), (6, 4, 1);

-- @@queries
-- Примеры для тренировки. Выделите запрос и нажмите Ctrl+Enter.

-- Выручка по категориям, только выполненные заказы
SELECT p.category, sum(oi.quantity * p.price) AS revenue
FROM order_items oi
JOIN orders o ON o.id = oi.order_id AND o.status = 'delivered'
JOIN products p ON p.id = oi.product_id
GROUP BY p.category
ORDER BY revenue DESC;

-- Подзапрос: клиенты, которые покупали дороже среднего чека
SELECT c.name, c.city
FROM customers c
WHERE c.id IN (
  SELECT o.customer_id
  FROM orders o
  JOIN order_items oi ON oi.order_id = o.id
  JOIN products p ON p.id = oi.product_id
  WHERE p.price > (SELECT avg(price) FROM products)
);

-- Клиенты без заказов
SELECT c.name
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE o.id IS NULL;

-- Последний заказ каждого клиента
SELECT DISTINCT ON (o.customer_id) o.customer_id, o.ordered_at, o.status
FROM orders o
ORDER BY o.customer_id, o.ordered_at DESC;
