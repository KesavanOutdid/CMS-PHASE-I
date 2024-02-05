import React, { useState } from 'react';
//import axios from 'axios';
import { Link } from 'react-router-dom';

  const Login = ({ handleLogin }) => {
    const [loginUsername, setUsername] = useState('');
    const [loginPassword, setPassword] = useState('');
    const [message, setMessage] = useState('');
    
    const handleLoginRequest = async (e) => {
        e.preventDefault();
    
        // Validation for user name
        const processedLoginUsername = loginUsername.replace(/\s+/g, '_');
    
        // Validation for password (4-digit number)
        const passwordPattern = /^\d{4}$/;
    
        if (processedLoginUsername !== loginUsername) {
            setMessage('User Name should not contain spaces, eg: Kesav_D , kesav_d.');
            return;
        }
    
        if (!passwordPattern.test(loginPassword)) {
            setMessage('Password must be a 4-digit number');
            return;
        }
    
        try {
            const response = await fetch('http://192.168.1.70:8052/CheckLoginCredentials', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ loginUsername: processedLoginUsername, loginPassword }),
            });
    
            if (response.ok) {
                const data = await response.json();
                handleLogin(data, processedLoginUsername);
            } else {
                const errorData = await response.json();
                setMessage(errorData.error || 'Login failed. Please check your credentials.');
            }
        } catch (error) {
            setMessage('An error occurred during login. Please try again later.');
        }
    };
  
    return (
        <section className="h-100">
            <div className="container h-100">
                <div className="row justify-content-sm-center h-100">
                    <div className="col-xxl-4 col-xl-5 col-lg-5 col-md-7 col-sm-9">
                        <div className="text-center my-5">
                            <img src="img/EV_Power_16-12-2023.png" alt="logo" width="250" />
                        </div>
                        <div className="card shadow-lg">
                            <div className="card-body p-5">
                                <h1 className="fs-4 card-title fw-bold mb-4">Login</h1>
                                <form onSubmit={handleLoginRequest}>
                                    <div className="mb-3">
                                        <label className="mb-2 text-muted" htmlFor="name">User Name</label>
                                        <input type="text" className="form-control" value={loginUsername} onChange={(e) => setUsername(e.target.value)} required/>
                                        <div className="invalid-feedback">User Name invalid</div>
                                    </div>

                                    <div className="mb-3">
                                        <label className="mb-2 text-muted" htmlFor="password">Password</label>
                                        <input type="password" className="form-control" value={loginPassword} onChange={(e) => setPassword(e.target.value)} required />
                                        <div className="invalid-feedback">Password is required</div>
                                    </div>
                                    {/* <div className="mb-3">
                                        <label className="mb-2 text-muted" htmlFor="password">Password</label>
                                        <input
                                          type="password"
                                          className={`form-control ${isValidPin(loginPassword) ? '' : 'is-invalid'}`}
                                          value={loginPassword}
                                          onChange={(e) => setPassword(e.target.value)}
                                          required
                                        />
                                        <div className="invalid-feedback">
                                          {isValidPin(loginPassword) ? null : 'Please enter a 4-digit numeric pin.'}
                                        </div>
                                      </div>*/}

                                    <div className="d-flex align-items-center">
                                        <button type="submit" className="btn btn-primary ms-auto">Login</button>
                                    </div> 
                                </form>
                            </div>
                            {message && (
                                <p className="text-danger mt-3" id="loginErrorMessage" aria-live="assertive" aria-atomic="true" aria-describedby="email" style={{textAlign:'center'}}>
                                    {message}
                                </p>
                            )}
                            <div className="card-footer py-3 border-0">
                                <div className="text-center">Don't have an account? <Link to="/Register" className="text-dark">Create One</Link></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default Login;
