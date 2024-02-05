import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Cookies from 'js-cookie';

const PaymentUnsuccess  = () => {
  const [paymentMessage, setPaymentMessage] = useState('');
  useEffect(() => {
    const message = Cookies.get('message');
    console.log('Message:', message)
    setPaymentMessage(message);

  }, []);

  return (
    <div className="vh-100 d-flex justify-content-center align-items-center">
      <div>
        <div className="mb-4 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="text-danger" width="75" height="75"  fill="currentColor"  viewBox="0 0 16 16">
            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708"/>
          </svg>
        </div>
        <div className="text-center">
          <h1>Payment Unsuccessful !</h1>
          <p>Payment amount not added to your wallet.</p>
          <p>{paymentMessage}</p>
          <Link to="/Home"><button className="btn btn-primary">Back Home</button></Link>
        </div>
      </div>
    </div>
  );
};
export default PaymentUnsuccess


