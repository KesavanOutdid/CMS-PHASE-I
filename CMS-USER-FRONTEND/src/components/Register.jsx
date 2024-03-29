import React, { useState, useRef } from 'react';
import axios from 'axios';
import { useHistory, Link } from 'react-router-dom';

const Register = () => {
    const [registerUsername, setUserName] = useState('');
    const [registerPhone, setUserPhone] = useState('');
	const [registerPasswords, setRegisterPasswords] = useState(['', '', '', '']);
	const inputRefs = useRef(Array.from({ length: 4 }, () => React.createRef()));
	// Joining the array elements into a single string
	const registerPassword = registerPasswords.join('');
	//  alert(registerPassword);
    const [message, setMessage] = useState('');
    const history = useHistory();

	// password pin change
	const handleChange = (index, value) => {
		if (/^\d?$/.test(value)) {
		  const newPasswords = [...registerPasswords];
		  newPasswords[index] = value;
		  setRegisterPasswords(newPasswords);
	
		  if (value === '' && index > 0) {
			inputRefs.current[index - 1].current.focus(); // Move focus backward when deleting a digit
		  } else if (index < inputRefs.current.length - 1 && value !== '') {
			inputRefs.current[index + 1].current.focus(); // Move focus forward when entering a digit
		  }
		}
	};

	// Register new user 
	const handleRegister = async (e) => {
        e.preventDefault(); 

		// Validation for user name
		const formattedUsername = registerUsername.replace(/\s+/g, '_');

		// Validation for password (4-digit number)
		const passwordPattern = /^\d{4}$/;
	
		// Validation for phone number (10 digits)
		const phonePattern = /^\d{10}$/;
	
		if (formattedUsername !== registerUsername) {
			setMessage('User Name should not contain spaces,eg: kesav_d');
			return;
		}
	
		if (!phonePattern.test(registerPhone)) {
			setMessage('Phone number must be a 10-digit number');
			return;
		}
	
		if (!passwordPattern.test(registerPassword)) {
			setMessage('Password must be a 4-digit number');
			return;
		}

        try {
            const response = await axios.post('/RegisterNewUser', {
                registerUsername: formattedUsername, registerPhone, registerPassword,
            });
            console.log(response.data); // Use console.log for debugging
            setMessage('User registered successfully');
            history.push('/');
        } catch (error) {
            console.log('Registration failed', error);
            setMessage(error.response.data.message);
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
							<img src="img/EV_Power_16-12-2023.png" alt="logo" width="250"/>
						</div>
						<div className="card shadow-lg">
							<div className="card-body p-5">
								<h1 className="fs-4 card-title fw-bold mb-4">Register</h1>
								<form onSubmit={handleRegister}>
									<div className="mb-3">
										<label className="mb-2 text-muted" htmlFor="name">User Name</label>
										<input type="text" className="form-control" value={registerUsername} onChange={(e) => setUserName(e.target.value)} required/>
										<div className="invalid-feedback">User Name is required</div>
									</div>
									
									<div className="mb-3">
										<label className="mb-2 text-muted" htmlFor="Phone">Phone</label>
										<input type="text" className="form-control" value={registerPhone} onChange={(e) => setUserPhone(e.target.value)} required/>
										<div className="invalid-feedback">Phone is required	</div>
									</div>

									<div className="mb-3">
										<label className="mb-2 text-muted" htmlFor="password">Password</label>
										<div className="otp-field mb-4">
											{registerPasswords.map((value, index) => (
											   <input key={index} ref={inputRefs.current[index]} type="number" className="form-control"  value={value}
												onChange={(e) => handleChange(index, e.target.value)} required maxLength={1}/>
											))}
										</div>
										<div className="invalid-feedback">Password is required</div>
									</div>

									<div className="align-items-center d-flex">
										<button type="submit" className="btn btn-primary ms-auto">Register</button>
									</div> 
								</form>
							</div>
							<div className="card-footer py-3 border-0">
								<div className="text-center">
									Already have an account? <Link to="/" className="text-dark">Login</Link>
								</div>
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
    )
}

export default Register
