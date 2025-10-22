/**
 * Функция для расчета выручки
 * @param purchase запись о покупке
 * @param _product карточка товара
 * @returns {number}
 */

function calculateSimpleRevenue(purchase, _product) {
  // purchase — это одна из записей в поле items из чека в data.purchase_records
  // _product — это продукт из коллекции data.products

  const { discount, sale_price, quantity } = purchase; // По сути нам передают items из purchase_records

  const discountSemi = 1 - discount / 100; // считаем скидку в десятичном формате

  return sale_price * quantity * discountSemi; // умножаем цену продажи покупателю на количество и скидку, получаем выручку
}

/**
 * Функция для расчета бонусов
 * @param index порядковый номер в отсортированном массиве
 * @param total общее число продавцов
 * @param seller карточка продавца
 * @returns {number}
 */

function calculateBonusByProfit(index, total, seller) {
  const { profit } = seller;

  // Расчет бонуса от места
  if (index === 0) {
    // Первый
    return profit * 0.15;
  } else if (index === 1 || index === 2) {
    // Второй и третий
    return profit * 0.1;
  } else if (index === total - 1) {
    // Последнее место
    return 0;
  } else {
    // Для всех остальных
    return profit * 0.05;
  }
}

/**
 * Функция для анализа данных продаж
 * @param data
 * @param options
 * @returns {{revenue, top_products, bonus, name, sales_count, profit, seller_id}[]}
 */

function analyzeSalesData(data, options) {
  // Здесь проверим входящие данные

  if (
    !data ||
    !Array.isArray(data.sellers) ||
    !Array.isArray(data.products) ||
    !Array.isArray(data.purchase_records) ||
    data.sellers.length === 0 ||
    data.products.length === 0 ||
    data.purchase_records.length === 0
  ) {
    throw new Error("Некорректные входные данные");
  }

  /* if (!options || typeof options !== "object") {
    throw new Error("Некорректные опции, возможно опции не объект");
  }
  */

  if (options == null || typeof options !== "object") {
    throw new Error("Некорректные опции, возможно опции не объект");
  }

  const { calculateRevenue, calculateBonus } = options; // Сюда передадим функции для расчётов

  if (!calculateRevenue || !calculateBonus) {
    throw new Error("Чего-то не хватает");
  }

  if (calculateRevenue === undefined || calculateBonus === undefined) {
    throw new Error("Опции не определены");
  }

  if (
    typeof calculateRevenue !== "function" ||
    typeof calculateBonus !== "function"
  ) {
    throw new Error("Опции не функции");
  }

  // Здесь посчитаем промежуточные данные и отсортируем продавцов

  let sellerStats = data.sellers.map((seller) => ({
    id: seller.id,
    name: `${seller.first_name} ${seller.last_name}`,
    revenue: 0, // доход
    profit: 0, // прибыль
    sales_count: 0, // количество продаж
    products_sold: {}, // продано товаров
  }));

  // Индексация

  let sellerIndex = Object.fromEntries(
    sellerStats.map((item) => [item.id, item])
  );

  //Перебрали sellerStats и сделали из него объект ключом в котором являются seller id,
  //а значением весь объект sellerStats для конкретного id

  let productIndex = Object.fromEntries(
    data.products.map((item) => [item.sku, item])
  );
  //То же самое что и в верхнем случае только перебираем data.products

  data.purchase_records.forEach((record) => {
    // Чек
    const seller = sellerIndex[record.seller_id]; // Продавец

    // Увеличить количество продаж
    seller.sales_count += 1;

    // Увеличить общую сумму всех продаж
    seller.revenue += record.total_amount;

    // Расчёт прибыли для каждого товара
    record.items.forEach((item) => {
      // перебираем товары (итемсы) в покупке (purchase_records), по сути в чеке

      const product = productIndex[item.sku]; // Товар

      // Посчитать себестоимость (cost) товара как product.purchase_price т.е. за которую мы товар закупали,
      // умноженную на количество товаров из чека
      let cost = product.purchase_price * item.quantity;

      // Посчитать выручку (revenue) с учётом скидки через функцию calculateRevenue
      let revenue = calculateRevenue(item, product);

      // Посчитать прибыль: выручка минус себестоимость
      let profit = revenue - cost;

      // Увеличить общую накопленную прибыль (profit) у продавца
      seller.profit += profit;

      // Учёт количества проданных товаров
      if (!seller.products_sold[item.sku]) {
        seller.products_sold[item.sku] = 0;
      }
      // По артикулу товара увеличить его проданное количество у продавца
      seller.products_sold[item.sku] += item.quantity;
    });
  });

  // Сортируем продавцов по прибыли
  sellerStats.sort((a, b) => b.profit - a.profit);

  // Вызовем функцию расчёта бонуса для каждого продавца в отсортированном массиве
  sellerStats.forEach((seller, index) => {
    // Индекс это номер текущего элемента в массиве
    seller.bonus = calculateBonus(index, sellerStats.length, seller); // Считаем бонус
    seller.top_products = Object.entries(seller.products_sold)
      .map(([sku, quantity]) => ({ sku, quantity }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10); // Формируем топ-10 товаров
  });

  // Сформируем и вернём отчёт
  return sellerStats.map((seller) => ({
    seller_id: seller.id, // Строка, идентификатор продавца
    name: seller.name, // Строка, имя продавца
    revenue: +seller.revenue.toFixed(2), // Число с двумя знаками после точки, выручка продавца
    profit: +seller.profit.toFixed(2), // Число с двумя знаками после точки, прибыль продавца
    sales_count: seller.sales_count, // Целое число, количество продаж продавца
    top_products: seller.top_products, // Массив объектов вида: { "sku": "SKU_008","quantity": 10}, топ-10 товаров продавца
    bonus: +seller.bonus.toFixed(2), // Число с двумя знаками после точки, бонус продавца
  }));
}
