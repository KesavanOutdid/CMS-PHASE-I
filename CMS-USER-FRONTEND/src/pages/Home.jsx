import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Home = ({ userInfo, handleLogout }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [walletBalance, setWalletBalance] = useState(null);
  const [searchChargerID, setChargerID] = useState('');
  const [ChargerID, setSearchChargerID] = useState('');
  const Username = userInfo.username;

  // const [timeoutId, setTimeoutId] = useState(null);
  const [isTimeoutRunning, setIsTimeoutRunning] = useState(false);
  
  // Logout server and client side
  const handleLogouts = async (ChargerID) => {
    try {
      if(ChargerID){
        const response = await fetch('/LogoutCheck', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
            body: JSON.stringify({ChargerID: ChargerID}),
          });
   
          if (response.ok) {
            handleLogout()
          }
      }else(
        handleLogout()
      )

      } catch (error) {
        alert(error);
      }
  };

  useEffect(() => {
    if (isTimeoutRunning) {
      // Start the timeout when isTimeoutRunning is true
      const id = setTimeout(() => {
        // Your timeout logic here
        handleSearchBox();
        setShowAlerts('Timeout, Please re-initiate the charger !');
        stopTimeout();
      }, 45000); // Example: 5 seconds delay  

      // Update timeoutId state with the ID returned by setTimeout
      // setTimeoutId(id);

      // Cleanup function to stop the timeout when component unmounts or isTimeoutRunning becomes false
      return () => clearTimeout(id);
    }
  }, [isTimeoutRunning]); // useEffect will re-run whenever isTimeoutRunning changes

  const startTimeout = () => {
    setIsTimeoutRunning(true); // Start the timeout by setting isTimeoutRunning to true
  };

  const stopTimeout = () => {
    setIsTimeoutRunning(false); // Stop the timeout by setting isTimeoutRunning to false
  };

  const EndChargingSession = async (ChargerID) => {
    try{
      const response = await fetch(`/endChargingSession?ChargerID=${ChargerID}`);
      const data = await response.json();
      console.log(data);
    }catch(error){
      console.error('Error End Charging Session:', error);
    }
  }
  
  // Show error history (toggle button) 
  const [isTableVisible, setIsTableVisible] = useState(false);
  const toggleTableVisibility = () => {
    setIsTableVisible(!isTableVisible);
  };

  // Get user wallet balance
  const fetchWallletBal = async (username) => {
    try {
      const response = await fetch(`/GetWalletBalance?username=${username}`);
      const data = await response.json();
      setWalletBalance(data.balance);
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  };

  useEffect(() => {
    fetchWallletBal(Username);
  }, [Username]);
  
 
  // Function to handle the "Back" button click
  async function handleSearchBox() {

    setChargerID('');
    setSearchChargerID('');
    stopTimeout();
    // Show the rechargeWalletSection
    document.getElementById('rechargeWalletSection').style.display = 'block';
    // Show the searchBoxSection
    document.getElementById('searchBoxSection').style.display = 'block';
    // Hide the statusSection (if needed)
    document.getElementById('statusSection').style.display = 'none';
    // Hide the "Back" button
    document.getElementById('backSection').style.display = 'none';

    await EndChargingSession(ChargerID);
  }

  // Alert message ( success, error)
  const [successData, setShowAlertsSuccess] = useState(false);
  const closeAlertSuccess = () => {
    setShowAlertsSuccess(false);
  };
  const [errorData, setShowAlerts] = useState(false);
  const closeAlert = () => {
    setShowAlerts(false);
  };
  
  // Search charger Id
  const handleSearchRequest = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/SearchCharger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
          body: JSON.stringify({ searchChargerID, Username }),
        });
 
        if (response.ok) {
          setSearchChargerID(searchChargerID);
          // Hide Search Box Section and show Status Section
          document.getElementById('rechargeWalletSection').style.display = 'none';
          document.getElementById('searchBoxSection').style.display = 'none';
          document.getElementById('statusSection').style.display = 'block';
          document.getElementById('backSection').style.display = 'block';
          // Additional logic or state updates can be added here
          setIsTableVisible(false);
          FetchLaststatus(searchChargerID);
        } else {
          const errorData = await response.json();
          // alert(errorData.message);
          setShowAlerts(errorData.message);
          // Show Search Box Section and hide Status Section
          document.getElementById('rechargeWalletSection').style.display = 'block';
          document.getElementById('searchBoxSection').style.display = 'block';
          document.getElementById('statusSection').style.display = 'none';
          document.getElementById('backSection').style.display = 'none';

          // Additional logic or state updates can be added here
          setIsTableVisible(false);
        }
      } catch (error) {
        alert(error);
        // Show Search Box Section and hide Status Section in case of an error
        document.getElementById('rechargeWalletSection').style.display = 'block';
        document.getElementById('searchBoxSection').style.display = 'block';
        document.getElementById('statusSection').style.display = 'none';
        document.getElementById('backSection').style.display = 'none';

        // Additional logic or state updates can be added here
        setIsTableVisible(false);
      }
  };

  const [ChargerStatus, setChargerStatus] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [checkFault, setCheckFault] = useState(false);
  const [historys, setHistory] = useState([]);
  const [voltage, setVoltage] = useState(0);
  const [current, setCurrent] = useState(0);
  const [power, setPower] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [frequency, setFrequency] = useState(0);
  const [temperature, setTemperature] = useState(0);

  // Last status
  async function FetchLaststatus(ChargerID){
    try {
      const response = await fetch('/FetchLaststatus', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: ChargerID }),
      });

      if (response.ok) {
        const data = await response.json();
        const status = data.message.status;
        const formattedTimestamp = formatTimestamp(data.message.timestamp);
        if(status === 'Available'){
           startTimeout();
        }
        setChargerStatus(status);
        setTimestamp(formattedTimestamp);
        AppendStatusTime(status, formattedTimestamp);
      } else {
        console.error(`Failed to fetch status. Status code: ${response.status}`);
      }
    } catch (error) {
       console.error(`Error while fetching status: ${error.message}`);
    }
  };
 
  const [socket, setSocket] = useState(null);

  // Effect to handle WebSocket connection
  useEffect(() => {
    // Check if the socket is not already open and ChargerID is provided
    if (!socket && ChargerID) {
      const newSocket = new WebSocket('ws://122.166.210.142:7050');

      newSocket.addEventListener('open', (event) => {
        console.log('WebSocket connection opened:', event);
      });

      newSocket.addEventListener('message', (response) => {
        const parsedMessage = JSON.parse(response.data);
        RcdMsg(parsedMessage);
      });

      newSocket.addEventListener('close', (event) => {
        console.log('WebSocket connection closed:', event);
      });

      newSocket.addEventListener('error', (event) => {
        console.error('WebSocket error:', event);
      });

      // Set the socket state
      setSocket(newSocket);
    }
    // Cleanup function to close the WebSocket when the component is unmounted
    return () => {
      if (socket) {
        socket.close();
        setSocket(null);
      }
    };
  }, [ChargerID, socket]);

  // WebSocket event listener message (all data)
  function RcdMsg(parsedMessage){
    let ChargerStatus;
    let CurrentTime;
    let errorCode;
    let user = Username;
    const { DeviceID, message } = parsedMessage;
      if (DeviceID === ChargerID) {
        switch (message[2]) {
          case 'StatusNotification':
            ChargerStatus = message[3].status;
            CurrentTime = formatTimestamp(message[3].timestamp);
            errorCode = message[3].errorCode;
            console.log(`ChargerID ${DeviceID}: {"status": "${ChargerStatus}","time": "${CurrentTime}","error": "${errorCode}"}`);
            if(ChargerStatus === 'Preparing'){
              stopTimeout();
            }
            if(ChargerStatus === 'Available'){
              startTimeout();
            }
            if(ChargerStatus === 'Charging'){
              handleAlertLodingStop();
            }
            // Update state variables to maintain the history
            if (errorCode !== 'NoError') {
              setHistory((historys) => [
                ...historys,
                {
                  serialNumber: historys.length + 1,
                  currentTime: CurrentTime,
                  chargerStatus: ChargerStatus,
                  errorCode: errorCode,
                },
              ]);
              setCheckFault(true);
            } else {
              setCheckFault(false);
            }
          break;

        case 'Heartbeat':
          CurrentTime = getCurrentTime();
          setTimestamp(CurrentTime);
        break;

        case 'MeterValues':
          const meterValues = message[3].meterValue;
          const sampledValue = meterValues[0].sampledValue;
          const formattedJson = convertToFormattedJson(sampledValue);

          // You can use state to store these values and update the state
          const updatedValues = {
            voltage: formattedJson['Voltage'],
            current: formattedJson['Current.Import'],
            power: formattedJson['Power.Active.Import'],
            energy: formattedJson['Energy.Active.Import.Register'],
            frequency: formattedJson['Frequency'],
            temperature: formattedJson['Temperature'],
          };
          setChargerStatus('Charging');
          setTimestamp(getCurrentTime());
          setVoltage(updatedValues.voltage);
          setCurrent(updatedValues.current);
          setPower(updatedValues.power);
          setEnergy(updatedValues.energy);
          setFrequency(updatedValues.frequency);
          setTemperature(updatedValues.temperature);
            console.log(`{ "V": ${updatedValues.voltage},"A": ${updatedValues.current},"W": ${updatedValues.power},"Wh": ${updatedValues.energy},"Hz": ${updatedValues.frequency},"Kelvin": ${updatedValues.temperature}}`);
        break;

        case 'Authorize':
          if (checkFault === false) {
            ChargerStatus = 'Authorized';
          }
          CurrentTime = getCurrentTime();
        break;

        case 'FirmwareStatusNotification':
          ChargerStatus = message[3].status.toUpperCase();
        break;

        case 'StopTransaction':
          ChargerStatus = 'Finishing';
          CurrentTime = getCurrentTime();
          handleAlertLodingStart();
          setTimeout(function () {
            updateSessionPriceToUser(ChargerID, user);
          }, 5000);
        break;

        case 'Accepted':
          ChargerStatus = 'ChargerAccepted';
          CurrentTime = getCurrentTime();
          break;
      }
    }
    if (ChargerStatus) {
      AppendStatusTime(ChargerStatus, CurrentTime);
    }
  }

  // Get current time
  const getCurrentTime = () => {
    const currentDate = new Date();
    const currentTime = currentDate.toISOString();
    return formatTimestamp(currentTime);
  };

  const formatTimestamp = (originalTimestamp) => {
    const date = new Date(originalTimestamp);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
  };

  // Function to convert the structure
  const convertToFormattedJson = (measurandArray) => {
    const formattedJson = {};
    measurandArray.forEach(measurandObj => {
      const key = measurandObj.measurand;
      const value = measurandObj.value;
      formattedJson[key] = value;
    });
    return formattedJson;
  };

   // start button
   const handleStartTransaction = async () => {
    try {
      const response = await fetch('/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: ChargerID, user: Username }),
      });

      if (response.status === 200) {
        const data = await response.json();
        console.log('ChargerStartInitiated');
        console.log(data.message);
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  };

  // stop button
  const handleStopTransaction = async () => {
    try {
      const response = await fetch('/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: ChargerID }),
      });

      if (response.status === 200) {
        const data = await response.json();
        console.log('ChargerStopInitiated');
        console.log(data.message);
      }
    } catch (error) {
      console.error('Error:', error.message);
    }
  };

  const AppendStatusTime = (ChargerStatus, CurrentTime) => {
    setChargerStatus(ChargerStatus);
    setTimestamp(CurrentTime);
 
    const startButton = document.getElementById("startTransactionBtn");
    const stopButton = document.getElementById("stopTransactionBtn");
 
    // Enabling start button when ChargerStatus is 'Preparing'
    startButton.disabled = ChargerStatus !== 'Preparing';
 
    // Enabling stop button when ChargerStatus is 'Charging'
    stopButton.disabled = ChargerStatus !== 'Charging';
  };

  const updateSessionPriceToUser = async (ChargerID, user) => {
    try {
      const response = await fetch('/getUpdatedCharingDetails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chargerID: ChargerID,
          user: user,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let chargingSession = data.value.chargingSession;
        let updatedUser = data.value.user;
        setApiData(chargingSession,updatedUser);
        handleAlertLodingStop();
        handleSearchBox();
        await fetchWallletBal(Username);
        await EndChargingSession(ChargerID);
      } else {
        // Log or handle error
        console.error('Update failed:', response.statusText);
      }
    } catch (error) {
      // Log or handle error
      console.error('Update failed:', error.message);
    }
  };

  // Alert message show
  const [showAlert, setShowAlert] = useState(false);
  const [chargingSession, setChargingSession] = useState({});
  const [updatedUser, setUpdatedUser] = useState({});

  const setApiData = (chargerSession,uservalue) => {
    console.log(uservalue);
    setChargingSession(chargerSession);
    setUpdatedUser(uservalue);
    setShowAlert(true);
  };

  // Alert message close
  const handleCloseAlert = () => {
    setShowAlert(false);
  };

  // Alert loding function
  const [showAlertLoding, setShowAlertLoding] = useState(false);

  const handleAlertLodingStart = () => {
    setShowAlertLoding(true);
  }

  const handleAlertLodingStop = () => {
    setShowAlertLoding(false);
  }

  // Get table data
  useEffect(() => {
    // Define the API URL based on the event detail
    const url = `/GetAllChargerDetails`;
    axios.get(url).then((res) => {
        setData(res.data.value);
        setLoading(false);
    })
       .catch((err) => {
        console.error('Error fetching data:', err);
        setError('Error fetching data. Please try again.');
        setLoading(false);
      });
  }, []);

  // View data
  const [selectedItem, setSelectedItem] = useState(null);

  const handleButtonClick = (dataItem) => {
    // Update state to store the selected item
    setSelectedItem(dataItem);
  };

  return (
    <div>
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-light bg-light">
        <span className="navbar-brand"><img src="img/EV_Power_16-12-2023.png" alt="logo" width="120"/></span>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ml-auto">
            <li className="nav-item">
              <form className="form-inline"  onClick={() => handleLogouts(ChargerID)}>
                <button type="button" className="button-br btn btn-outline-danger">Logout</button>
              </form>
            </li>
          </ul>
        </div>
      </nav>
      {/* Container for Page welcome session start */}
      <div className="container mt-4">
        <div className="col-md-12">
          <blockquote className="blockquote">
            <div className="row">
              <div className="col-md-6 mb-2">
                <h2 style={{ paddingTop: '10px' }}>
                  <strong>Welcome </strong> <span className="text-colors" >{Username},</span>
                </h2>
              </div>
              <div className="col-md-6 mb-2 pr-3">
                <button type="submit" className="button-br btn btn-outline-primary float-end" id="backSection" style={{ display: 'none' }} onClick={handleSearchBox}>Back</button>
              </div>
            </div>
          </blockquote>
        </div>
      </div>
     
      <div className="container mt-4">
        {/* Wallet Section start */}
        <div className="col-md-12" >
          <blockquote className="blockquote">
            <div className="card mb-4">
              <div className="card-body">
                <div className="container text-center">
                  <div className="row justify-content-around">
                    <div className="col-12 col-sm-4">
                        <div className="container mt-3">
                          <h2 className="card-title">My Wallet</h2>
                          <div>
                            {walletBalance !== null ? (
                              <p>Available balance: Rs. {walletBalance}</p>
                            ) : (
                              <p>Loading wallet balance...</p>
                            )}
                          </div>
                        </div>
                    </div>
                    <div className="col-12 col-sm-4" id="rechargeWalletSection">
                      <div className="container mt-3">
                        <h2 className="card-title">Recharge Wallet</h2>
                        <form action="http://122.166.210.142:8052/pay" method="get" className="d-flex flex-column">
                          <div className="d-flex justify-content-center">
                            <button type="submit" value="500" name="amount" className="button-45 mr-2">Rs.500</button>
                            <button type="submit" value="1000" name="amount" className="button-45 mr-2">Rs.1000</button>
                            <button type="submit" value="2000" name="amount" className="button-45">Rs.2000</button>
                          </div>
                          <input type="hidden" name="RCuser" value={Username}/>
                        </form>
                        <form action="http://122.166.210.142:8052/pay" method="get" className="d-flex flex-column" style={{ paddingTop: '10px' }}>
                          <div className="d-flex justify-content-center">
                            <input type="number" min="500" name="amount"  className="form-control inputBorder text-center" placeholder="Enter Amount" required/> &nbsp;
                              <button type="submit" className="button-br btn btn-outline-success">Submit</button>
                          </div>
                          <input type="hidden" name="RCuser" value={Username}/>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </blockquote>
        </div>
        {/* Wallet Section end */}

        {/* Charger Search Box and charger list table Section  start */}
        <div id="searchBoxSection">
          <div className="col-md-12">
            <blockquote className="blockquote">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title text-center"><span className="text-colors">SEARCH</span> DEVICE</h2>
                  <form onSubmit={handleSearchRequest}>
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                      <div className="form-group formGroup">
                        <input type="text"  className="form-control text-center inputBorder" id="chargerID" name="chargerID" value={searchChargerID} onChange={(e) => setChargerID(e.target.value)} placeholder="Enter DeviceID" required />
                        <button type="submit" className="button-br btn btn-outline-success srcMarginTop">Search</button>
                      </div>                    
                    </div>
                  </form>
                </div>
              </div>
            </blockquote>
          </div>
          {/* charger list start */}
          <div className="col-md-12" >
            <blockquote className="blockquote">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title">Charger list</h2> 
                  {/* <div className="wrapper center-block">
                    <div className="panel-group" id="accordion" role="tablist" aria-multiselectable="true">
                      <div className="panel panel-default">
                        <div className="panel-heading active" role="tab" id="headingOne">
                          <h4 className="panel-title">
                            <div className="row text-center text-padding">
                              <div className="col-sm-2 col-12">Sl.No</div>
                              <div className="col-sm-3 col-12"> DeviceID</div>
                              <div className="col-sm-3 col-12"> TagID</div>
                              <div className="col-sm-2 col-12">Type</div>
                              <div className="col-sm-2 col-12">Option</div>
                            </div>
                          </h4>
                        </div>                
                      </div>                           
                    </div>
                  </div>
                    {loading ? (
                      <div className="wrapper center-block">
                        <div className="panel-group" id="accordion" role="tablist" aria-multiselectable="true">
                          <div className="panel panel-default">
                            <div className="panel-heading active" role="tab" id="headingOne">
                              <h4 className="panel-title">
                                <div className="row text-center text-padding">
                                  <div className="col-sm-12">Loading...</div>
                                </div>
                              </h4>
                            </div>                
                          </div>                           
                        </div>
                      </div>
                    ) : error ? (
                      <div className="wrapper center-block">
                        <div className="panel-group" id="accordion" role="tablist" aria-multiselectable="true">
                          <div className="panel panel-default">
                            <div className="panel-heading active" role="tab" id="headingOne">
                              <h4 className="panel-title">
                                <div className="row text-center text-padding">
                                  <div className="col-sm-12">Error:</div>
                                </div>
                              </h4>
                            </div>
                          </div>                
                        </div>  
                      </div>                         
                    ) : (   
                      Array.isArray(data) && data.length > 0 ? (
                      data.map((dataItem, index) => (
                      <React.Fragment key={index}>
                        <div className="wrapper center-block">
                          <div className="panel-group" id="accordion" role="tablist" aria-multiselectable="true">
                            <div className="panel panel-default">
                              <div className="panel-heading active" role="tab" id="headingOne">
                                <h4 className="panel-title" style={{paddingBottom:'0px'}}>
                                  <div className="row text-center text-padding font-size">
                                    <div className="col-sm-2">{index + 1}</div>
                                    <div className="col-sm-3">{dataItem.ChargerID ? (<span>{dataItem.ChargerID}</span>) : ( <span>-</span>)}</div>
                                    <div className="col-sm-3">{dataItem.ChargerTagID ? ( <span>{dataItem.ChargerTagID}</span> ) : (<span>-</span>)}</div>
                                    <div className="col-sm-2">{dataItem.charger_type ? (<span>{dataItem.charger_type}</span>  ) : ( <span>-</span>)}</div>
                                    <div className="col-sm-2">{dataItem ? (<span><button type="button" className="button-br btn btn-outline-success" data-toggle="modal" data-target="#myModal" onClick={() => handleButtonClick(dataItem)}>View</button></span>) : (<span>-</span>)}</div>
                                  </div>
                                </h4>
                              </div>                
                            </div>                            
                          </div>
                        </div>
                        
                        {selectedItem === dataItem && (
                          <div className="container">
                            <div className="modal" id="myModal">
                              <div className="modal-dialog modal-lg modal-dialog-centered">
                                <div className="modal-content">
                                  <h3 className="text-primary text-center padding20">Charger Details</h3>
                                  <div className="modal-header textCenter"></div>
                                  <div className="modal-body marginLeft20">
                                    <div className="row padTop20">
                                      <div className="col-sm-4 text-left">
                                        <label className="titleLabel">DeviceID</label>
                                        <p>{dataItem.ChargerID}</p>
                                      </div>                                                
                                      <div className="col-sm-4 text-left">
                                        <label className="titleLabel">TagID</label>
                                        <p>{dataItem.ChargerTagID}</p>
                                      </div>
                                      <div className="col-sm-4 text-left">
                                        <label className="titleLabel">Charger Model</label>
                                        <p>{dataItem.charger_model}</p>
                                      </div>
                                    </div><hr/>
                                    <div className="row padTop20">
                                      <div className="col-sm-4 text-left">
                                        <label className="titleLabel">Charger Type</label>
                                        <p>{dataItem.charger_type}</p>
                                      </div>
                                      <div className="col-sm-4 text-left">
                                        <label className="titleLabel">Current Phase</label>
                                        <p>{dataItem.current_phase}</p>
                                      </div>
                                      <div className="col-sm-4 text-left">
                                        <label className="titleLabel">Gun Connector</label>
                                        <p>{dataItem.gun_connector}</p>
                                      </div>
                                    </div><hr/>
                                    <div className="row padTop20">
                                      <div className="col-sm-4 text-left">
                                        <label className="titleLabel">Max Current</label>
                                        <p>{dataItem.max_current}</p>
                                      </div>
                                      <div className="col-sm-4 text-left">
                                        <label className="titleLabel">Max Power</label>
                                        <p>{dataItem.max_power}</p>
                                      </div>
                                      <div className="col-sm-4 text-left">
                                        <label className="titleLabel">Socket Count</label>
                                        <p>{dataItem.socket_count}</p>
                                      </div>
                                    </div>
                                  </div>
                                  <div className="modal-footer">
                                    <button type="button" className="btn btn-danger" data-dismiss="modal">Close</button>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </React.Fragment>
                    ))
                  ) : (
                    <div className="col-sm-12">No devices found.</div>
                    )
                  )} */}
                   <div className="table-container">
                    <table className="table table-hover text-center">
                      <thead className="sticky-md-top">
                        <tr>
                          <th>Sl.No</th>
                          <th>DeviceID</th>
                          <th>TagID</th>
                          <th>Type</th>
                          <th>Option</th>
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr>
                            <td colSpan="5" style={{ marginTop: '50px', textAlign: 'center' }}>Loading...</td>
                          </tr>
                        ) : error ? (
                          <tr>
                            <td colSpan="5" style={{ marginTop: '50px', textAlign: 'center' }}>Error: {error}</td>
                          </tr>
                        ) : (
                          Array.isArray(data) && data.length > 0 ? (
                            data.map((dataItem, index) => (
                              <React.Fragment key={index}>
                                <tr>
                                  <td>{index + 1}</td>
                                  <td>{dataItem.ChargerID ? (
                                    <span>{dataItem.ChargerID}</span>
                                  ) : (
                                    <span>-</span>
                                  )}
                                  </td>
                                  <td>{dataItem.ChargerTagID ? (
                                    <span>{dataItem.ChargerTagID}</span>
                                  ) : (
                                    <span>-</span>
                                  )}
                                  </td>
                                  <td>{dataItem.charger_type ? (
                                    <span>{dataItem.charger_type}</span>
                                  ) : (
                                    <span>-</span>
                                  )}
                                  </td>
                                  <td>{dataItem ? (
                                    <span>
                                      <button type="button" className="button-br btn btn-outline-success" data-toggle="modal" data-target="#myModal" onClick={() => handleButtonClick(dataItem)}>View</button>
                                    </span>
                                    ) : (
                                      <span>-</span>
                                    )}
                                  </td>
                                </tr>
                                {selectedItem === dataItem && (
                                  <div className="container">
                                    <div className="modal" id="myModal">
                                      <div className="modal-dialog modal-lg modal-dialog-centered">
                                        <div className="modal-content">
                                        <h3 className="text-colors text-center paddingTop">CHARGER DETAILS</h3>
                                          {/* <div className="modal-header textCenter"></div> */}
                                          <div className="modal-body marginLeft20">
                                            <div className="row padTop20" style={{borderBottom:'1px'}}>
                                                <div className="col-sm-4 text-left">
                                                  <label className="titleLabel">DeviceID</label>
                                                  <p>{dataItem.ChargerID}</p>
                                                </div>                                                
                                                <div className="col-sm-4 text-left">
                                                  <label className="titleLabel">TagID</label>
                                                    <p>{dataItem.ChargerTagID}</p>
                                                </div>
                                                <div className="col-sm-4 text-left">
                                                  <label className="titleLabel">Charger Model</label>
                                                  <p>{dataItem.charger_model}</p>
                                                </div>
                                            </div><hr/>
                                            <div className="row padTop20">
                                                <div className="col-sm-4 text-left">
                                                <label className="titleLabel">Charger Type</label>
                                                  <p>{dataItem.charger_type}</p>
                                                </div>
                                                <div className="col-sm-4 text-left">
                                                  <label className="titleLabel">Current Phase</label>
                                                  <p>{dataItem.current_phase}</p>
                                                </div>
                                                <div className="col-sm-4 text-left">
                                                  <label className="titleLabel">Gun Connector</label>
                                                    <p>{dataItem.gun_connector}</p>
                                                  </div>
                                            </div><hr/>
                                            <div className="row padTop20">
                                                <div className="col-sm-4 text-left">
                                                  <label className="titleLabel">Max Current</label>
                                                  <p>{dataItem.max_current}</p>
                                                </div>
                                                <div className="col-sm-4 text-left">
                                                  <label className="titleLabel">Max Power</label>
                                                  <p>{dataItem.max_power}</p>
                                                </div>
                                                <div className="col-sm-4 text-left">
                                                  <label className="titleLabel">Socket Count</label>
                                                  <p>{dataItem.socket_count}</p>
                                                </div>
                                            </div>
                                          </div>
                                          <div className="modal-footer">
                                            <button type="button" className="btn btn-danger" data-dismiss="modal">Close</button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </React.Fragment>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="4" className="text-center" style={{ marginTop: '50px'}}>No devices found.</td>
                            </tr>
                          )
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </blockquote>
          </div>
        </div>
        {/* Charger Search Box and charger list table Section end */}
      
        {/* Charger status Section  start*/}
        <div className="col-md-12" id="statusSection" style={{ display: 'none' }}>
          <blockquote className="blockquote">
            <div className="card">
              <div className="card-body">
                <div className="text-center">
                  <h2 className="card-title text-colors">CHARGER STATUS</h2>
                  <h5>{ChargerStatus}</h5>
                  <h5>{timestamp}</h5>
                  <h5 className="text-colors">{ChargerID}</h5>
                </div>
                <div className="container cardContainer">
                  <div className="row">
                    <div className="col-12 col-sm-4">
                      <div className="container mt-3">
                        <div className="card radius_bgColor">
                          <div className="card-body"><strong>Voltage : </strong> <span>{voltage}</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="col-12 col-sm-4">
                      <div className="container mt-3">
                        <div className="card radius_bgColor">
                          <div className="card-body"><strong>Current : </strong> <span>{current}</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="col-12 col-sm-4">
                      <div className="container mt-3">
                        <div className="card radius_bgColor">
                          <div className="card-body"><strong>Power :</strong> <span>{power}</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="col-12 col-sm-4">
                      <div className="container mt-3">
                        <div className="card radius_bgColor">
                          <div className="card-body"><strong>Energy : </strong> <span>{energy}</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="col-12 col-sm-4">
                      <div className="container mt-3">
                        <div className="card radius_bgColor">
                          <div className="card-body"><strong>Frequency : </strong> <span>{frequency}</span></div>
                        </div>
                      </div>
                    </div>
                    <div className="col-12 col-sm-4">
                      <div className="container mt-3">
                        <div className="card radius_bgColor">
                          <div className="card-body"><strong>Temperature : </strong> <span>{temperature}</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="container">
                  <div className="row justify-content-around text-center">
                    <div className="col-12 col-sm-5">
                      <div className="container mt-4">
                        <button type="submit" className="button-br btn btn-outline-success" onClick={handleStartTransaction} disabled={ChargerStatus !== 'Preparing'} id="startTransactionBtn" style={{width:'40%', borderRadius: '20px'}}><b>Start</b></button>    
                      </div>
                    </div>
                    <div className="col-12 col-sm-5">
                      <div className="container mt-4">
                        <button type="submit" className="button-br btn btn-outline-danger" onClick={handleStopTransaction} disabled={ChargerStatus !== 'Charging'} id="stopTransactionBtn" style={{width:'40%', borderRadius: '20px'}}><b>Stop</b></button>                        
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-center paddingTop">
                  <button type="submit" className="button-br btn btn-outline-primary" onClick={toggleTableVisibility}>
                    <span>{isTableVisible ? 'Hide Error History' : 'Show Error History'}</span>
                  </button>
                </div>
                {isTableVisible && (
                  <div className="col-lg-12 grid-margin stretch-card" style={{paddingTop:'20px'}}>
                    <div className="card">
                      <div className="card-body">
                        <div className="table-container">
                          <table className="table table-striped text-center" >
                            <thead className="sticky-md-top">
                              <tr>
                                <th>Sl.No</th>
                                <th>Timestamp</th>
                                <th>Status</th>
                                <th>Error</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historys.length > 0 ? (
                                historys.map((entry) => (
                                  <tr key={entry.serialNumber}>
                                    <td>{entry.serialNumber}</td>
                                    <td>{entry.currentTime}</td>
                                    <td>{entry.chargerStatus}</td>
                                    <td>{entry.errorCode}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan="4" style={{ marginTop: '50px', textAlign: 'center' }}>No error found.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="col-md-12 grid-margin stretch-card paddingTop" >
                  <div className="">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-12 card" style={{backgroundColor:'rgb(232 239 96 / 67%)', borderRadius:'30px'}}>
                          <div className="table-responsive">
                            <div className="danger" style={{paddingLeft: '10px', paddingBottom:'5px', color: 'black'}}>
                              <h4 className="paddingTop"><u>THRESHOLD LEVEL:</u></h4>
                              <p><strong>Voltage level : </strong> Input under voltage - 175V and below. &nbsp;&nbsp;&nbsp;Input over voltage - 270V and above.</p>
                              <p><strong>Current :</strong> Over Current - 33A.</p>
                              <p><strong>Frequency :</strong> Under frequency - 47HZ. &nbsp;&nbsp;&nbsp;Over frequency - 53HZ.</p>
                              <p><strong>Temperature :</strong> Low Temperature - 0 °C. &nbsp;&nbsp;&nbsp; High Temperature - 58 °C.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </blockquote>
        </div>
        {/* Charger status Section stop*/}
      </div>

        {/* Alert success message start */}
        {successData && (
          <div className="alert-overlay">
            <div className="alert success alerts" style={{width:'500px', textAlign:'center'}}>
              <span className="alertClose" onClick={closeAlertSuccess}>X</span>
              <span className="alertText" style={{fontSize:'20px'}}><strong style={{color:'#155724'}}>{successData}</strong></span>
            </div>
          </div>
        )}
        {/* Alert success message end */}

        {/* Loding alert */}
        {showAlertLoding &&  (
          <div className="alert-overlay-loding">
            <div className="alert-loding success alerts" style={{width:'200px', textAlign:'center', padding:"20px"}}>
              <div class="spinner-border text-success" role="status" style={{fontSize:'20px'}}>
                <span class="visually-hidden">Loading...</span>
              </div>
            </div>
          </div>
        )}
        {/* Loding alert */}

        {/* Alert charger update Session Price To User start*/}
        {showAlert && (
          <div className="alert-overlay">
            <div className="alert success alerts showAlert" style={{borderRadius:'25px'}}>
              <span className="alertClose" onClick={handleCloseAlert}>X</span>
              <div className="mb-4 text-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="text-success" width="55" height="55"  fill="currentColor"  viewBox="0 0 16 16">
                  <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z" />
                </svg>
              </div>
              <div className="text-center">
                <h2 className="text-color">Charging Done !</h2>
                <div className="row text-padding"> 
                  <div className="col-sm-6">
                    <span className="alertText"><strong>ChargerID</strong></span>
                    <p>{chargingSession.ChargerID}</p>
                  </div>
                  <div className="col-sm-6">
                    <span className="alertText"><strong>Start Time</strong></span>
                    <p>{chargingSession.StartTimestamp && new Date(chargingSession.StartTimestamp).toLocaleString('en-US', {timeZone: 'Asia/Kolkata'})}</p>
                  </div>
                  <div className="col-sm-6">
                    <span className="alertText"><strong>Stop Time</strong></span>
                    <p>{chargingSession.StopTimestamp && new Date(chargingSession.StopTimestamp).toLocaleString('en-US', {timeZone: 'Asia/Kolkata'})}</p>
                  </div>
                  <div className="col-sm-6">
                    <span className="alertText"><strong>Unit Consumed</strong></span>
                    <p>{chargingSession.Unitconsumed}</p>
                  </div>
                  <div className="col-sm-6">
                    <span className="alertText"><strong>Charging Price</strong></span>
                    <p className="text-color"><strong>{chargingSession.price}</strong></p>
                  </div>
                  <div className="col-sm-6">
                    <span className="alertText"><strong>Available Balance</strong></span>
                    <p>{updatedUser.walletBalance}</p>
                  </div>
                </div>
              
              </div>
            </div>
          </div>
        )}
        {/* Alert charger update Session Price To User end*/}

        {/* Alert error message start */}
        {errorData && (
          <div className="alert alert-warning alert-dismissible fade show alert-container text-center" role="alert" style={{width:'415px'}}>
            <strong>{errorData}</strong> 
            <button type="button" className="close" data-dismiss="alert" aria-label="Close" onClick={closeAlert} style={{top:'7px'}}>
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        )}
        {/* Alert error message end*/}
    </div>
  );
};

export default Home;