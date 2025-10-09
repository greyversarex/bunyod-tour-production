<?php 
include("bs_panel/config/connect.php");
?>
<!DOCTYPE html>
<html lang="ru">

  <head>
    <title>Бунёд-Тур - туры по Таджикистану и Центральной Азии</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no">  
    <meta property="og:image" content="../images/кор.jpg"/>
    <meta property="og:type"  content="img" />
    <meta property="og:title" content="<?php echo $title;?>" />    
    <link href="https://fonts.googleapis.com/css?family=Muli:300,400,600,700" rel="stylesheet">
    <link rel="stylesheet" href="../css/open-iconic-bootstrap.min.css">
    <link rel="stylesheet" href="../css/animate.css">    
    <link rel="stylesheet" href="../css/owl.carousel.min.css">
    <link rel="stylesheet" href="../css/owl.theme.default.min.css">
    <link rel="stylesheet" href="../css/magnific-popup.css">
     <meta name="description" content="Туристические услуги, туры по всем странам мира, бронирование, авиабилеты, туристические компании, Душанбе">  

    <meta name="keywords" content="Туристические услуги, туры по всем странам мира, туры в Таджикистан, отели, авиабилеты, трансфер, бронирование, планирование и организация туров, Таджикистан, Республика Таджикистан, туры, экскурсия, оздоровительные туры, лечения за рубежом, международные туры, услуги гида, переводчик, услуги переводчика, туристические компании, туристическое агентство, Душанбе, туры по Таджикистану и Центральной Азии"> 


    <link rel="stylesheet" href="../css/aos.css">
    <link rel="stylesheet" href="../css/ionicons.min.css">
    <link rel="stylesheet" href="../css/bootstrap-datepicker.css">
    <link rel="stylesheet" href="../css/jquery.timepicker.css">

<!-- End Facebook Pixel Code -->
    
    <link rel="stylesheet" href="../css/flaticon.css">
    <link rel="stylesheet" href="../css/icomoon.css">
    <link rel="stylesheet" href="../css/style.css">
    <link rel="stylesheet" href="../css/sash.css">

    <link rel="shortcut icon" href="../images/Logo-Ru1.png">
  </head>
  <body>
   
    <nav class="navbar navbar-expand-lg navbar-dark ftco_navbar bg-dark ftco-navbar-light" id="ftco-navbar">
      <div class="container-fluid">
        <a class="navbar-brand" href="index.php"><img src="../images/Logo-Ru1.png" height='80' width='90' style="margin-left: 20px;"></a>
         <a class="navbar-brand" href="https://www.pata.org/" target="_blank"><img src="../images/PATA-Logo-H2.jpg" height='80' class="shap" ></a>
        <button class="navbar-toggler" type="button" data-toggle="collapse" data-target="#ftco-nav" aria-controls="ftco-nav" aria-expanded="false" aria-label="Toggle navigation">
          <span class="oi oi-menu"></span> Menu
        </button>

        <div class="collapse navbar-collapse" id="ftco-nav">
           <ul class="navbar-nav ml-auto" style="color: black;">
           
<ul class="menu">
    <li><span class="nav-link" style="color: white !important;">Бронирование</span>
     <ul class="submenu">
            <li><a href=turi.php>Туры</a></li>
            <li><a href=hotel.php>Отели</a></li>
            <li><a href=aviabilet.php>Авиабилеты</a></li>
        </ul>
  </li>
          </ul>
           <div class="ftco-footer-widget" style="margin-top: 17px; margin-left: 25px;">
              <ul class="ftco-footer-social list-unstyled ">
                <a class="navbar-brand" href="index.php"><img src="../images/tj.png" height='40' width='40'></a>
                <a class="navbar-brand" href="index.php"><img src="../images/ru.png" height='40' width='40'></a>
                <a class="navbar-brand" href="index.php"><img src="../images/en.png" height='35' width='35'></a>
              </ul>
            </div>
        </div>



      </div>
    </nav>

  <style>
.border {
list-style: none;
padding: 0;
width: auto;
margin: 0 auto;
color: blue;
}
.border li {
font-family: "Trebuchet MS", "Lucida Sans";
padding: 7px 20px;
color: blue;
margin: 20px;
border-radius: 5px;
border-left: 10px solid #f05d22; 
box-shadow: 2px -2px 5px 0 rgba(0,0,0,.1),
     -2px -2px 5px 0 rgba(0,0,0,.1),
    2px 2px 5px 0 rgba(0,0,0,.1),
    -2px 2px 5px 0 rgba(0,0,0,.1);
font-size: 20px;
letter-spacing: 2px;
transition: 0.3s all linear;
}
.border li:nth-child(2){border-color: #8bc63e;}
.border li:nth-child(3){border-color: #fcba30;}
.border li:nth-child(4){border-color: #1ccfc9;}
.border li:nth-child(5){border-color: #493224;}
.border li:hover {border-left: 10px solid transparent;}
.border li:nth-child(1):hover {border-right: 10px solid #f05d22;}
.border li:nth-child(2):hover {border-right: 10px solid #8bc63e;}
.border li:nth-child(3):hover {border-right: 10px solid #fcba30;}
.border li:nth-child(4):hover {border-right: 10px solid #1ccfc9;}
.border li:nth-child(5):hover {border-right: 10px solid #493224;}

</style>  


    <section class="ftco-section contact-section" style="margin-top: 50px; margin-bottom: 80px;">
 
<div class="events page_section">
    <div class="container">
      
        <div class="row event_item">
          <div class="col" align="center">
            <div class="row d-flex flex-row align-items-end">

              <div class="col-lg-12 order-lg-1 order-1">
 <div class="text23" style="font-weight: 700; text-transform: uppercase;"> С "Бунёд-Тур" каждый может заработать!</div>
 <div class="pic"><img src="../images/кор.jpg" class="nu"></div>
  <div class="text1t" style="font-size: 20px !important; text-align: justify !important; line-height: 1.3;">
Представляем вашему вниманию Программу «Турагент», в рамках которой каждое физическое и юридическое лицо может стать Турагентом нашей компании – реализовать (продавать) наши туры.  
</br>
Турагент компании может стать лицо, достигшее 16 летного возраста или любое юридическое лицо, а также и индивидуальные предприниматели.
</br>
</br>
Турагентам предоставляется денежное вознаграждение (кэшбэк) по нижеуказанным ставкам: </br>
&nbsp; &nbsp;• Физическим лицам (гражданам Таджикистана) – до 11% от стоимости (суммы) тура;</br>
&nbsp;&nbsp;• Юридическим лицам, нерезидентам (иностранным организациям) – до 9% от стоимости (суммы) тура. </br>
</br>


Основная задача агента, это продвижение (реклама) и реализация туров компании среди граждан Таджикистана и зарубежных стран. За каждый проданный турпакет Турагент незамедлительно получить свое вознаграждение в соответствии с заключенным договором.
</br>
</br>

Для того, чтобы получит статус Турагента, заинтересованным лицам необходимо следовать нижеследующие шаги:</br>


&nbsp; &nbsp;1. Выбирать нужный договор и скачать его. </br>
&nbsp;&nbsp;2. Пополнить необходимые (пустые) места договора. </br>
&nbsp;&nbsp;3. Подписать договор и отсканировать его. </br>
&nbsp;&nbsp;4. Отправить отсканированную договор на почту <a href="mailto:info@bunyodtour.tj">info@bunyodtour.tj</a> или принести собой в наш офис – ул. Айни, 104, г.Душанбе, Таджикистан, 734042. </br>
</div>


                <ul class="border" align="left">
   <li ><a href="../images/АГЕНТСКИЙ-ДОГОВОР.pdf" download style="color: #95969E;">
        <span><img src="../images/icon.jpg" height="30"></span> &nbsp; Агентский договор для физических лиц <span style="float: right;"><img src="../images/dow.png" height="30"></span></a></li> 
        <li ><a href="../images/АГЕНТСКИЙ-ДОГОВОР.pdf" download style="color: #95969E;">
        <span><img src="../images/icon.jpg" height="30"></span> &nbsp; Агентский договор для инностранных тур компаний <span style="float: right;"><img src="../images/dow.png" height="30"></span></a></li>
  
  

</ul>
              </div>

            </div>  
          </div>
        </div>

        <div style="margin-top: 50px; text-align: center;">
   <script type="text/javascript">(function() {
  if (window.pluso)if (typeof window.pluso.start == "function") return;
  if (window.ifpluso==undefined) { window.ifpluso = 1;
    var d = document, s = d.createElement('script'), g = 'getElementsByTagName';
    s.type = 'text/javascript'; s.charset='UTF-8'; s.async = true;
    s.src = ('https:' == window.location.protocol ? 'https' : 'http')  + '://share.pluso.ru/pluso-like.js';
    var h=d[g]('body')[0];
    h.appendChild(s);
  }})();</script>
<div class="pluso" data-background="transparent" data-options="medium,round,line,horizontal,nocounter,theme=04" data-services="vkontakte,facebook,twitter,google,moimir,print"></div>  
</div>
          </div>
        </div>

            
 

    

    </section>


    </section>
    


    <?php  
include ("include/footer.php");

?>
  
 <!-- loader -->
  <div id="ftco-loader" class="show fullscreen"><svg class="circular" width="48px" height="48px"><circle class="path-bg" cx="24" cy="24" r="22" fill="none" stroke-width="4" stroke="#eeeeee"/><circle class="path" cx="24" cy="24" r="22" fill="none" stroke-width="4" stroke-miterlimit="10" stroke="#F96D00"/></svg></div>



  <script src="js/jquery.min.js"></script>
  <script src="js/jquery-migrate-3.0.1.min.js"></script>
  <script src="js/popper.min.js"></script>
  <script src="js/bootstrap.min.js"></script>
  <script src="js/jquery.easing.1.3.js"></script>
  <script src="js/jquery.waypoints.min.js"></script>
  <script src="js/jquery.stellar.min.js"></script>
  <script src="js/owl.carousel.min.js"></script>
  <script src="js/jquery.magnific-popup.min.js"></script>
  <script src="js/aos.js"></script>
  <script src="js/jquery.animateNumber.min.js"></script>
  <script src="js/bootstrap-datepicker.js"></script>
  <script src="js/jquery.timepicker.min.js"></script>
  <script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyBVWaKrjvy3MaE7SQ74_uJiULgl1JY0H2s&sensor=false"></script>
  <script src="js/google-map.js"></script>
  <script src="js/main.js"></script>
    
  </body>
</html>