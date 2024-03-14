import React, { useState, useEffect } from "react";
import { useHistory } from 'react-router-dom'; 
import axios from 'axios';
import Swal from 'sweetalert2';

const Configuration = ({ handleLogout }) => {
    const history = useHistory();
    const [chargerId, setChargerId] = useState("");
    const [commandsLibrary, setCommandsLibrary] = useState([]);
    const [selectedCommand, setSelectedCommand] = useState("");
    const [payload, setPayload] = useState();
    const [response, setResponse] = useState();

    function RegError(Message){
        Swal.fire({
            title: "Failed", 
            text: Message,
            icon: "error",
            customClass: {
                popup: 'swal-popup-center', // Center the entire popup
                icon: 'swal-icon-center',   // Center the icon within the popup
            },
        });
    }

    const getActionPayload = async () => {
        try {
            const response = await axios.get('/GetAction');
            console.log("Data",response.data)
            setCommandsLibrary(response.data);
        } catch (error) {
            console.error('Error fetching action payload:', error);
        }
    };

    useEffect(() => {
        // Fetch the list of btn from your backend
        getActionPayload();
    }, []);

    const onCommandClick = (index) => {
        const selectedCommand = commandsLibrary[index];
        setSelectedCommand(selectedCommand.action);
        setPayload(selectedCommand.payload);
        setResponse();
    };
    
    const onSendCommand = async () => {
        try {
            if (!chargerId.trim()) {
                let setMessage = "Please enter a valid charger ID";
                RegError(setMessage);
                return false;
            }
            if (!payload) {
                let setMessage = "Please select a command.";
                RegError(setMessage);
                return false;
            }
            console.log("chargerId", chargerId);
            console.log("payload", payload.key);
            console.log("selectedCommand", selectedCommand);
    
            // Show SweetAlert
            Swal.fire({
                title: 'Loading',
                html: 'Waiting for command response...',
                didOpen: async() => {
                    Swal.showLoading();

                    const response = await axios.get(`/SendOCPPRequest?id=${chargerId}&req=${encodeURIComponent(JSON.stringify(payload))}&actionBtn=${selectedCommand}`);
                    const responseData = await response.data;
                    setResponse(responseData, null, " ");

                    // Close the SweetAlert when response is received
                    if (responseData) {
                        Swal.fire({
                            position: 'center',
                            icon: 'success',
                            title: 'Command Response Received successfully',
                            showConfirmButton: false,
                            timer: 1500
                        });
                    }
                }
            });
        } catch (error) {
            console.error('Error sending command:', error);
            alert('An error occurred while sending the command.');
        }
    };
    
    const handleChargerIdChange = (event) => {
        setChargerId(event.target.value);
    };

    return (
        <div className="mb-5">
            <nav className="navbar navbar-expand-lg navbar-light bg-light">
                <span className="navbar-brand pl-4 pt-0"><img src="img/EV_Power_16-12-2023.png" alt="logo" width="120"/></span>
                <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
                <span className="navbar-toggler-icon" data-bs-toggle="offcanvas" data-bs-target="#offcanvasRight" aria-controls="offcanvasRight"></span>
                </button>
                <div className="collapse navbar-collapse" id="navbarNav">
                    <ul className="navbar-nav ms-auto">
                        <li className="nav-item">
                            <i className="fa fa-ellipsis-v hideMobile fontPading" aria-hidden="true" data-bs-toggle="offcanvas" data-bs-target="#offcanvasRight" aria-controls="offcanvasRight"></i>
                        </li>
                    </ul>
                </div>
            </nav>
            <div className="offcanvas offcanvas-end" tabIndex="-1" id="offcanvasRight" aria-labelledby="offcanvasRightLabel" style={{width:'300px'}}>
                <div className="offcanvas-header">
                    <h4 id="offcanvasRightLabel" className="text-colors">Menu</h4>
                    <button type="button" className="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
                </div>
                <div className="offcanvas-body">
                    <div className="list-group list-group-flush"> 
                        <h4 className="list-group-item-action list-group-item text-reset"  onClick={handleLogout}>Logout</h4>
                    </div>
                </div>
            </div>
            <div className="container mt-4">
                <div className="col-md-12">
                    <blockquote className="blockquote">
                        <div className="row">
                        <div className="d-flex justify-content-between align-items-center flex-wrap mb-4">
                                <h3 className="card-title mt-4 mb-3"><b><strong className='oc fs-1'>OCPP</strong> Configuration</b></h3>                       
                                    {/* Show only on small screens */}
                                    <button className="btn  mt-3 btn-sm d-block d-sm-block d-lg-none text-danger border border-danger" onClick={() => history.goBack()} style={{  borderRadius: '15px', width: 'auto', maxWidth: '200px' }}>Go Back</button>
                                    <div className="d-flex align-items-center mb-3">
                                        <div className="input-group mt-lg-4  mt-3 mr-lg-5">
                                            <input type="text" className="form-control form-control-lg start" placeholder="ChargerID" id="chargerId" value={chargerId} onChange={handleChargerIdChange} required />
                                            <button className="btn btn-lg btn-send text-white" style={{ backgroundColor: '#5ae753d2'}} type="submit" onClick={onSendCommand}>SEND</button>
                                        </div>
                                </div>
                                {/* Show only on large screens */}
                                <button className="btn mt-lg-3 btn-lg d-none text-danger d-lg-inline-block border border-danger" onClick={() => history.goBack()} style={{ borderRadius: '20px', width: 'auto', maxWidth: '200px' }}>Go Back</button>
                            </div>
                            <div className="col-sm-6 ">
                                <div className="col-sm-12 ">
                                <h2 className="card-title mt-2  ml-4 text-center"><b> Command</b></h2>
                                    <div className="mt-3">
                                        <div className="row">
                                            {commandsLibrary.length > 0 ? (
                                                commandsLibrary.map((command, index) => (
                                                    <div className="col-lg-6 mb-3" key={index}>
                                                    <button className="btn btn-lg font-weight-medium w-100 mb-3 ml-lg-4 text-wrap text-center" style={{ backgroundColor: '#5ae753d2', borderRadius: '20px' }} onClick={() => onCommandClick(index)}>
                                                    {command.action}
                                                    </button>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="text-center">No commands available</p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="col-sm-6 mt-3">
                                <div className="card" style={{ height: "330px" }}>
                                    <div className="card-header">
                                        <ul className="nav nav-tabs card-header-tabs">
                                            <li className="nav-item">
                                                <a className="nav-link active" href="#payload">Payload</a>
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="card-body overflow-auto">
                                        <pre id="payload">{payload ? JSON.stringify(payload, null, 2) : ""}</pre>
                                    </div>
                                </div>
                                <div className="card mt-4" style={{ height: "330px" }}>
                                    <div className="card-header">
                                        <ul className="nav nav-tabs card-header-tabs">
                                            <li className="nav-item">
                                                <a className="nav-link active" href="#response">Command Response</a>
                                            </li>
                                        </ul>
                                    </div>
                                    <div className="card-body overflow-auto">
                                        <pre id="response">{response ? JSON.stringify(response, null, 2) : ""}</pre>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </blockquote>
                </div>
            </div>
        </div>
    );
};

export default Configuration;
