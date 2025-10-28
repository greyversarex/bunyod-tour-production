<?php


// Настройки
$mail = new PHPMailer;
$mail->isSMTP(); 
$mail->Host = ‘smtp.yandex.ru’; 
$mail->SMTPAuth = true; 
$mail->Username = ‘ramaz.nur’; // Ваш логин в Яндексе. Именно логин, без @yandex.ru
$mail->Password = ‘rn625ss’; // Ваш пароль
$mail->SMTPSecure = ‘ssl’; 
$mail->Port = 465;
$mail->setFrom(‘ramaz.nur@yandex.ru’); // Ваш Email
$mail->addAddress(‘ramaz.nur@yandex.ru’); // Email получателя


?>