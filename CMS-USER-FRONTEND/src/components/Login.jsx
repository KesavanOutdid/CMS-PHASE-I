import React, { useState, useRef } from 'react';
import { Link } from 'react-router-dom';

const Login = ({ handleLogin }) => {
    const [loginUsername, setUsername] = useState('');
    // const [loginPassword, setPassword] = useState('');
    const [loginPasswords, setLoginPassword] = useState(['', '', '', '']);
	const inputRefs = useRef(Array.from({ length: 4 }, () => React.createRef()));
	// Joining the array elements into a single string
	const loginPassword = loginPasswords.join('');
	//  alert(registerPassword);
    const [message, setMessage] = useState('');
    
    // password pin change
	const handleChange = (index, value) => {
		if (/^\d?$/.test(value)) {
		  const newPasswords = [...loginPasswords];
		  newPasswords[index] = value;
		  setLoginPassword(newPasswords);
	
		  if (value === '' && index > 0) {
			inputRefs.current[index - 1].current.focus(); // Move focus backward when deleting a digit
		  } else if (index < inputRefs.current.length - 1 && value !== '') {
			inputRefs.current[index + 1].current.focus(); // Move focus forward when entering a digit
		  }
		}
	};

    // Check login credentials
    const handleLoginRequest = async (e) => {
        e.preventDefault();
    
        // Validation for user name
        const processedLoginUsername = loginUsername.replace(/\s+/g, '_');
    
        // Validation for password (4-digit number)
        const passwordPattern = /^\d{4}$/;
    
        if (processedLoginUsername !== loginUsername) {
            setMessage('User Name should not contain spaces,eg: kesav_d');
            return;
        }
    
        if (!passwordPattern.test(loginPassword)) {
            setMessage('Password must be a 4-digit number');
            return;
        }
    
        try {
            const response = await fetch('/CheckLoginCredentials', {
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

    // Alert message clocse
    const closeAlert = () => {
        setMessage(false);
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
                                        <div className="otp-field mb-4">
											{loginPasswords.map((value, index) => (
											   <input key={index} ref={inputRefs.current[index]} type="password" className="form-control"  value={value}
												onChange={(e) => handleChange(index, e.target.value)} required maxLength={1}/>
											))}
										</div>
                                        {/* <input type="password" className="form-control" value={loginPassword} onChange={(e) => setPassword(e.target.value)} required /> */}
                                        <div className="invalid-feedback">Password is required</div>
                                    </div>

                                    <div className="d-flex align-items-center">
                                        <button type="submit" className="btn btn-primary ms-auto">Login</button>
                                    </div> 
                                </form>
                            </div>
                            <div className="card-footer py-3 border-0">
                                <div className="text-center">Don't have an account? <Link to="/Register" className="text-dark">Create One</Link></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            {/* Alert message */}
            {message && (
                <div className="alert alert-warning alert-dismissible fade show alert-container" role="alert">
                    <strong>{message}</strong> 
                    <button type="button" className="close" data-dismiss="alert" aria-label="Close" onClick={closeAlert} style={{top:'7px'}}>
                        <span aria-hidden="true">&times;</span>
                    </button>
                </div>
            )}
            {/* Alert message */}
        </section>
    );
};

export default Login;
