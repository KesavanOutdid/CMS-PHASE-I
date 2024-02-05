import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Redirect } from 'react-router-dom';
import Login from './components/Login';
import Register from './components/Register';
import Home from './pages/Home';
import PaymentSuccess from './pages/PaymentSuccess';
import PaymentUnsuccess from './pages/PaymentUnsuccess';  

const App = () => {
  const storedUser = JSON.parse(sessionStorage.getItem('user'));
  const [loggedIn, setLoggedIn] = useState(!!storedUser);

  const [userInfo, setUserInfo] = useState(storedUser || {});
  const [initialLoad, setInitialLoad] = useState(false);

  useEffect(() => {
    setInitialLoad(true);
  }, []);

  const handleLogin = (data, username) => {
    setUserInfo({ username });
    setLoggedIn(true);
    sessionStorage.setItem('user', JSON.stringify({ username }));
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setUserInfo({});
    sessionStorage.removeItem('user');
  };

  return (
    <Router>
      <Route path="/register" component={Register} />

      {/* Redirect to Home if logged in, otherwise show Login */}
      <Route exact path="/">
        {loggedIn ? <Redirect to="/Home" /> : <Login handleLogin={handleLogin} />}
      </Route>

      {/* Home route */}
      <Route path="/Home">
        {loggedIn ? (
          initialLoad ? (
            <Home userInfo={userInfo} handleLogout={handleLogout}/>
          ) : (
            <Home userInfo={userInfo} handleLogout={handleLogout} setInitialLoad={setInitialLoad} />
          )
        ) : (
          <Redirect to="/" />
        )}
      </Route>

      {/* Redirect to PaymentSuccess if logged in, otherwise show Login */}
      <Route path="/PaymentSuccess">
        {loggedIn ? <PaymentSuccess userInfo={userInfo}  handleLogout={handleLogout} /> : <Redirect to="/" />}
      </Route>

      {/* Redirect to PaymentUnsuccess if logged in, otherwise show Login */}
      <Route path="/PaymentUnsuccess">
        {loggedIn ? <PaymentUnsuccess userInfo={userInfo}  handleLogout={handleLogout} /> : <Redirect to="/" />}
      </Route>
    </Router>
  );
};

export default App;
