<!DOCTYPE html>
<html lang="ru">
  <head>
    <title>Бунёд-Тур - Безопасная оплата</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">   
    <link href="https://fonts.googleapis.com/css?family=Muli:300,400,600,700" rel="stylesheet">
    <link rel="stylesheet" href="../css/open-iconic-bootstrap.min.css">
    <link rel="stylesheet" href="../css/animate.css">    
    <link rel="stylesheet" href="../css/owl.carousel.min.css">
    <link rel="stylesheet" href="../css/owl.theme.default.min.css">
    <link rel="stylesheet" href="../css/magnific-popup.css">
    <link rel="stylesheet" href="../css/aos.css">
    <link rel="stylesheet" href="../css/ionicons.min.css">
    <link rel="stylesheet" href="../css/bootstrap-datepicker.css">
    <link rel="stylesheet" href="../css/jquery.timepicker.css">
    <link rel="stylesheet" href="../css/flaticon.css">
    <link rel="stylesheet" href="../css/icomoon.css">
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/sash.css">
    <link rel="shortcut icon" href="../images/Logo-Ru1.png">
    
    <!-- === Стили для страницы оплаты === -->
    <style>
        body { background-color: #f4f7f9; }
        .checkout-container { width: 100%; max-width: 550px; background-color: #ffffff; border-radius: 12px; box-shadow: 0 10px 40px rgba(0,0,0,0.08); padding: 30px 40px; }
        .checkout-header { text-align: center; margin-bottom: 25px; border-bottom: 1px solid #eee; padding-bottom: 20px; }
        .checkout-header h1 { font-size: 28px; font-weight: 600; margin-bottom: 5px; }
        .order-details { display: flex; justify-content: space-between; align-items: center; padding: 15px 0px; font-size: 16px; border-bottom: 1px solid #eee; margin-bottom: 25px; }
        .order-details span { color: #6c757d; }
        .order-details strong { font-size: 18px; color: #000; }
        .payment-options-list form { display: block; }
        
        .payment-card {
            border: 1px solid #e9ecef; 
            border-radius: 12px; 
            margin-bottom: 20px; 
            text-decoration: none; 
            color: #212529; 
            background-color: #fff; 
            width: 100%; 
            text-align: left; 
            transition: box-shadow 0.2s; 
            cursor:pointer;
            overflow: hidden;
        }
        .payment-card:hover {
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }
        .payment-card-image-wrapper {
            background-color: #fff;
            padding: 20px;
            text-align: center;
            border-bottom: 1px solid #e9ecef;
        }
        .payment-card-image-wrapper img {
            width: 85%;
            max-width: 220px;
            height: auto;
        }
        .payment-card-image-wrapper.large-icon img {
            max-width: 250px;
        }
        .payment-card-info {
            display: flex;
            align-items: center;
            padding: 15px 20px;
        }
        .payment-card-info strong {
            flex-grow: 1;
            font-size: 16px; 
            font-weight: 600;
        }
        .payment-card-info .payment-chevron {
            font-size: 24px;
            font-weight: bold;
            color: #adb5bd;
        }
    </style>
    <!-- === КОНЕЦ СТИЛЕЙ === -->

  </head>
  <body>
   
  <nav class="navbar navbar-expand-lg navbar-dark ftco_navbar bg-dark ftco-navbar-light" id="ftco-navbar">
      <div class="container-fluid">
        <a class="navbar-brand" href="index.php"><img src="../images/Logo-Ru1.png" height='80' width='80' style="margin-left: 20px;"></a>
        <a class="navbar-brand" href="https://www.pata.org/" target="_blank"><img src="../images/PATA-Logo-H2.jpg" height='80' class="shap" ></a>
      </div>
    </nav>

<!-- === ГЛАВНОЕ ИЗМЕНЕНИЕ ЗДЕСЬ: Добавлен отступ сверху === -->
<section class="ftco-section" id="f1" style="padding-top: 120px; padding-bottom: 50px;">
    <div class="container">
        <div class="row justify-content-center">
            <div class="col-lg-8">
                <div class="checkout-container">
                    <div class="checkout-header">
                        <h1>Безопасная оплата</h1>
                        <p>Пожалуйста, выберите способ оплаты для завершения бронирования.</p>
                    </div>

                    <div class="order-details">
                        <span>Заказ №<?php echo htmlspecialchars($orderId); ?></span>
                        <strong><?php echo htmlspecialchars(round($amount)); ?> TJS</strong>
                    </div>

                    <div class="payment-options-list">

                        <!-- СПОСОБ #1 (СТАРЫЙ): Pay with VISA / MASTERCARD CARDS (Payler) -->
                        <form method='POST' action='../paylerpay.php'>
                            <input type='hidden' value='<?=$last_id?>' name='last_id'>
                            <input type='hidden' value='<?=$total_price?>' name='amount'>
                            <button type="submit" class="payment-card">
                                <div class="payment-card-image-wrapper"><img src="../images/payment-visa-mastercard.png"></div>
                                <div class="payment-card-info">
                                    <strong>Оплатить картой VISA / MASTERCARD - Payler</strong>
                                    <span class="payment-chevron">›</span>
                                </div>
                            </button>
                        </form>

                        <!-- СПОСОБ #2 (НОВЫЙ): Pay with VISA / MASTERCARD CARDS (Alif) -->
                        <form name="AlifPayFormVisa" action="https://web.alif.tj/" method="post">
                            <input type="hidden" name="key" value="<?php echo $key;?>">
                            <input type="hidden" name="token" value="<?php echo hash_hmac('sha256', $key.$orderId.number_format($amount, 2, '.', '').$callbackUrl, hash_hmac('sha256', $password, $key)); ?>">
                            <input type="hidden" name="orderId" value="<?php echo $orderId;?>">
                            <input type="hidden" name="amount" value="<?php echo $amount;?>">
                            <input type="hidden" name="callbackUrl" value="<?php echo $callbackUrl;?>">
                            <input type="hidden" name="returnUrl" value="<?php echo $returnUrl;?>">
                            <input type="hidden" name="info" value="<?php echo $info;?>">
                            <input type="hidden" name="email" value="<?php echo $email;?>">
                            <input type="hidden" name="phone" value="<?php echo $phone;?>">
                            <input type="hidden" name="gate" value="vsa">
                            <button type="submit" class="payment-card">
                                <div class="payment-card-image-wrapper"><img src="../images/payment-visa-mastercard.png"></div>
                                <div class="payment-card-info">
                                    <strong>Оплатить картой VISA / MASTERCARD - AlifPay</strong>
                                    <span class="payment-chevron">›</span>
                                </div>
                            </button>
                        </form>

                        <!-- СПОСОБ #3 (СТАРЫЙ): Pay with CRIPTOCURRENCY (Binance) -->
                        <form name="BinancePay" method="scan">
                            <button class="payment-card">
                                <div class="payment-card-image-wrapper large-icon"><img src="../images/payment-crypto.png"></div>
                                <div class="payment-card-info">
                                    <strong>Оплатить Криптовалютой</strong>
                                    <span class="payment-chevron">›</span>
                                </div>
                            </button>
                        </form>

                        <!-- СПОСОБ #4 (СТАРЫЙ): Pay with KORTI MILLI (Alif) -->
                        <form name="AlifPayForm" action="https://web.alif.tj/" method="post" id="alifPayForm">
                            <input type="hidden" name="key" value="<?php echo $key;?>">
                            <input type="hidden" name="token" value="<?php echo hash_hmac('sha256', $key.$orderId.number_format($amount, 2, '.', '').$callbackUrl, hash_hmac('sha256', $password, $key)); ?>">
                            <input type="hidden" name="orderId" value="<?php echo $orderId;?>">
                            <input type="hidden" name="amount" value="<?php echo $amount;?>">
                            <input type="hidden" name="callbackUrl" value="<?php echo $callbackUrl;?>">
                            <input type="hidden" name="returnUrl" value="<?php echo $returnUrl;?>">
                            <input type="hidden" name="info" value="<?php echo $info;?>">
                            <input type="hidden" name="email" value="<?php echo $email;?>">
                            <input type="hidden" name="phone" value="<?php echo $phone;?>">
                            <input type="hidden" name="gate" value="km">
                            <button type="submit" class="payment-card">
                                <div class="payment-card-image-wrapper large-icon"><img src="../images/payment-korti-milli.png"></div>
                                <div class="payment-card-info">
                                    <strong>Оплатить КОРТИ МИЛЛИ</strong>
                                    <span class="payment-chevron">›</span>
                                </div>
                            </button>
                        </form>
                        
                    </div>
                </div>
            </div>
        </div>
    </div>
</section>  

<?php include ("../include/footer.php"); ?>  

  <div id="ftco-loader" class="show fullscreen"><svg class="circular" width="48px" height="48px"><circle class="path-bg" cx="24" cy="24" r="22" fill="none" stroke-width="4" stroke="#eeeeee"/><circle class="path" cx="24" cy="24" r="22" fill="none" stroke-width="4" stroke-miterlimit="10" stroke="#F96D00"/></svg></div>
  <script src="../js/jquery.min.js"></script>
  <script src="../js/jquery-migrate-3.0.1.min.js"></script>
  <script src="../js/popper.min.js"></script>
  <script src="../js/bootstrap.min.js"></script>
  <script src="../js/jquery.easing.1.3.js"></script>
  <script src="../js/jquery.waypoints.min.js"></script>
  <script src="../js/jquery.stellar.min.js"></script>
  <script src="../js/owl.carousel.min.js"></script>
  <script src="../js/jquery.magnific-popup.min.js"></script>
  <script src="../js/aos.js"></script>
  <script src="../js/jquery.animateNumber.min.js"></script>
  <script src="../js/bootstrap-datepicker.js"></script>
  <script src="../js/jquery.timepicker.min.js"></script>
  <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBVWaKrjvy3MaE7SQ74_uJiULgl1JY0H2s&sensor=false"></script>
  <script src="../js/google-map.js"></script>
  <script src="../js/main.js"></script>
    
</body>
</html>