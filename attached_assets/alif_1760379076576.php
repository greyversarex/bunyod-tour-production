<?php
class Alif
{
    private $secretkey;
    public  $key; 
    public  $amount;
    public  $info; 
    public  $orderid;
    public  $callbackUrl;
    public  $returnUrl;
    public  $email;
    public  $phone;
    public  $status;
    public  $transactionId;
    public function __construct($key, $pass)
    {
        $this->key = $key;
        $this->secretkey = hash_hmac('sha256', $pass, $key);
    }
    function token(){
      $this->amount = sprintf('%.2f',$this->amount);
      if($this->amount !== '' && $this->key !== '' && $this->orderid !== '' && $this->callbackUrl !== ''){
        return hash_hmac('sha256', $this->key.$this->orderid.$this->amount.$this->callbackUrl, $this->secretkey);
      }
    }
    function callback(){
        return hash_hmac('sha256', $this->orderid.$this->status.$this->transactionId, $this->secretkey);
    }
    function checkOrderToken(){
        return hash_hmac('sha256', $this->key.$this->orderid, $this->secretkey);
    }
    function tokenInfo($jsn){
        return hash_hmac('sha256', $jsn, $this->secretkey);
    }
}
?>