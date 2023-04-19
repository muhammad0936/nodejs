const Product = require('../models/product');
const Order = require('../models/order');
const fs = require('fs');
const path = require('path');
const PDFdocument = require('pdfkit');
const stripe = require('stripe')('sk_test_51MMCsdIrSYobvX7EjOS2Pt7KlJwuEryz451tstyuivD4U8y7QbRuAwGi5jNyhj4FjGb3XA4mXwu0KBj34XQFUXlm000INCyX62');


const productsPerPage = 15;


exports.getIndex = (req, res, next) => {
  var page = +req.query.page;
  if(!page)
  {
    page = 1;
  }
  let totalItems;
  Product
  .find()
  .countDocuments()
  .then(productsCount => {
    totalItems = productsCount;
    return Product.find()
    .skip(( page - 1 ) * productsPerPage)
    .limit(productsPerPage)
  })
    .then(products => {
      res.render('shop/index', {
        prods: products,
        pageTitle: 'Shop',
        path: '/',
        page : page,
        hasNextPage : page * productsPerPage < totalItems,
        hasPreviousPage : page > 1,
        previousPage : page - 1,
        nextPage : page + 1,
        lastPage : Math.ceil(totalItems / productsPerPage)
      });
    })
    .catch(err => {
      const error = new Error(err);
      console.log(error)
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProducts = (req, res, next) => {
  var page = +req.query.page;
  if(!page)
  {
    page = 1;
  }
  let totalItems;
  Product
  .find()
  .countDocuments()
  .then(productsCount => {
    totalItems = productsCount;
    return Product.find()
    .skip(( page - 1 ) * productsPerPage)
    .limit(productsPerPage)
  })
    .then(products => {
      res.render('shop/product-list', {
        prods: products,
        pageTitle: 'Products',
        path: '/products',
        page : page,
        hasNextPage : page * productsPerPage < totalItems,
        hasPreviousPage : page > 1,
        previousPage : page - 1,
        nextPage : page + 1,
        lastPage : Math.ceil(totalItems / productsPerPage)
      });
    })
    .catch(err => {
      const error = new Error(err);
      console.log(error)
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getProduct = (req, res, next) => {
  const prodId = req.params.productId;
  Product.findById(prodId)
    .then(product => {
      res.render('shop/product-detail', {
        product: product,
        pageTitle: product.title,
        path: '/products'
      });
    })
    .catch(err => {
        const error = new Error(err);
        console.log(error)
        error.httpStatusCode = 500;
        return next(error);});
};


exports.getCart = (req, res, next) => {
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items;
      res.render('shop/cart', {
        path: '/cart',
        pageTitle: 'Your Cart',
        products: products
      });
    })
    .catch(err => {
      const error = new Error(err);
      console.log(error)
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.postCart = (req, res, next) => {
  const prodId = req.body.productId;
  Product.findById(prodId)
    .then(product => {
      return req.user.addToCart(product);
    })
    .then(result => {
      res.redirect('back');
    });
};

exports.postCartDeleteProduct = (req, res, next) => {
  const prodId = req.body.productId;
  req.user
    .removeFromCart(prodId)
    .then(result => {
      res.redirect('/cart');
    })
    .catch(err => {
      const error = new Error(err);
      console.log(error)
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getCheckout = (req, res, next) => {
  let products;
  let totalPrice = 0 ;
  req.user
  .populate('cart.items.productId')
  .execPopulate()
  .then(user => {
     products = user.cart.items;
     user.cart.items.forEach(p => {
      totalPrice += p.quantity * p.productId.price;
    });
    return stripe.checkout.sessions.create({
      payment_method_types : ['card'],
      line_items : products.map(product => {
        return {
          name : product.productId.title,
          description : product.productId.description,
          amount : product.productId.price * 100,
          currency : 'usd',
          quantity : product.quantity
        }
      }),
      success_url : req.protocol + '://' + req.get('host') + '/checkout/success',
      canceel_url : req.protocol + '://' + req.get('host') + '/checkout/cancel'
    })
    .then(session => {
      res.render('shop/checkout', {
        pageTitle: 'Checkout',
        path : '/checkout',
        products : products,
        totalPrice : totalPrice,
        session_id : session.id
      });
    })
    .catch(err => {
      const error = new Error(err)
      console.log(error);
      error.httpStatusCode = 500;
      return next(error);
    })

  
  })
  .catch(err => {
    const error = new Error(err);
    console.log(error)
    error.httpStatusCode = 500;
    return next(error);
  });
}

exports.postOrder = (req, res, next) => { 
  req.user
    .populate('cart.items.productId')
    .execPopulate()
    .then(user => {
      const products = user.cart.items.map(i => {
        return { quantity: i.quantity, product: { ...i.productId._doc } };
      });
      const order = new Order({
        user: {
          email: req.user.email,
          userId: req.user
        },
        products: products
      });
      return order.save();
    })
    .then(result => {
      return req.user.clearCart();
    })
    .then(() => {
      res.redirect('/orders');
    })
    .catch(err => {
      console.log(err)
      const error = new Error(err);
      error.httpStatusCode = 500;
      return next(error);
      });
};

exports.getOrders = (req, res, next) => {
  Order.find({ 'user.userId': req.user._id })
    .then(orders => {
      res.render('shop/orders', {
        path: '/orders',
        pageTitle: 'Your Orders',
        orders: orders
      });
    })
    .catch(err => {
      const error = new Error(err);
      console.log(error)
      error.httpStatusCode = 500;
      return next(error);
    });
};

exports.getInvoice = (req, res, next) => {
  const orderId = req.params.orderId;
  Order.findById(orderId)
    .then(order => {
      if (!order) {
        return next(new Error('No order found.'));
      }
      if (order.user.userId.toString() !== req.user._id.toString()) {
        return next(new Error('Unauthorized'));
      }
      const invoiceName = 'invoice-' + orderId + '.pdf';
      const invoicePath = path.join('data', 'invoices', invoiceName);

      const pdfDoc = new PDFdocument();
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        'download; filename="' + invoiceName + '"'
      );

      pdfDoc.pipe(fs.createWriteStream(invoicePath));
      pdfDoc.pipe(res);
      pdfDoc.fontSize(25).text('Company name is here \n \n')
      pdfDoc.fontSize(17).text(`Order ID : ${order._id} :`);
      let totalPrice = 0 ;
      order.products.forEach(prod => {
        totalPrice += prod.quantity*prod.product.price;
        pdfDoc.fontSize(12)
        .text(`${prod.product.title} : ${prod.quantity} * ${prod.product.price} = $${prod.quantity*prod.product.price}.`)
      })
      pdfDoc.fontSize(22).text('__________________________');
      pdfDoc.fontSize(22).text(`Total Price : $${totalPrice}.`)
      pdfDoc.end();
      // fs.readFile(invoicePath, (err, data) => {
      //   if (err) {
      //     return next(err);
      //   }
      //   res.setHeader('Content-Type', 'application/pdf');
      //   res.setHeader(
      //     'Content-Disposition',
      //     'inline; filename="' + invoiceName + '"'
      //   );
      //   res.send(data);
      // });
      //************** 
      // res.setHeader('Content-Type', 'application/pdf');
      // res.setHeader(
      //   'Content-Disposition',
      //   'download; filename="' + invoiceName + '"'
      // );
      // const file = fs.createReadStream(invoicePath);
      // file.pipe(res);
    })
    .catch(err => {
      const error = new Error(err);
      console.log(error)
      error.httpStatusCode = 500;
      return next(error);
    });
};
