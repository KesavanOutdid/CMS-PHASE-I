import React, { useEffect, useState } from 'react';
import axios from 'axios';

const Home = ({ userInfo, handleLogout }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTableVisible, setIsTableVisible] = useState(false);
  const toggleTableVisibility = () => {
    setIsTableVisible(!isTableVisible);
  };
  const [walletBalance, setWalletBalance] = useState(null);
  const [searchChargerID, setChargerID] = useState('');
  const [ChargerID, setSearchChargerID] = useState('');
  const Username = userInfo.username;
  // useEffect(() => {
  //   const fetchWallletBal = async () => {
  //     try {
  //       const response = await fetch(`http://192.168.1.70:8052/GetWalletBalance?username=${Username}`);
  //       const data = await response.json();
  //       setWalletBalance(data.balance);
  //     } catch (error) {
  //       console.error('Error fetching wallet balance:', error);
  //     }
  //   };

  //   fetchWallletBal();
  // }, [Username]);
  const fetchWallletBal = async (username) => {
    try {
      const response = await fetch(`http://192.168.1.70:8052/GetWalletBalance?username=${username}`);
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
  function handleSearchBox() {

    setChargerID('');
    setSearchChargerID('');
    // Show the searchBoxSection
    document.getElementById('searchBoxSection').style.display = 'block';
    // Hide the statusSection (if needed)
    document.getElementById('statusSection').style.display = 'none';
    // Hide the "Back" button
    document.getElementById('backSection').style.display = 'none';
  }

  const [errorData, setShowAlerts] = useState(false);
  const closeAlert = () => {
    setShowAlerts(false);
  };

  const handleSearchRequest = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('http://192.168.1.70:8052/SearchCharger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
          body: JSON.stringify({ searchChargerID, Username }),
        });
 
        if (response.ok) {
          //const data = await response.json();
          // console.log(data, searchChargerID);
          setSearchChargerID(searchChargerID);

          // Hide Search Box Section and show Status Section
          document.getElementById('searchBoxSection').style.display = 'none';
          document.getElementById('statusSection').style.display = 'block';
          document.getElementById('backSection').style.display = 'block';

          // Additional logic or state updates can be added here
          setIsTableVisible(false);
        } else {
          const errorData = await response.json();
          // alert(errorData.message);
          setShowAlerts(errorData);
          // Show Search Box Section and hide Status Section
          document.getElementById('searchBoxSection').style.display = 'block';
          document.getElementById('statusSection').style.display = 'none';
          document.getElementById('backSection').style.display = 'none';

          // Additional logic or state updates can be added here
          setIsTableVisible(false);
        }
      } catch (error) {
        alert(error);
        // Show Search Box Section and hide Status Section in case of an error
        document.getElementById('searchBoxSection').style.display = 'block';
        document.getElementById('statusSection').style.display = 'none';
        document.getElementById('backSection').style.display = 'none';

        // Additional logic or state updates can be added here
        setIsTableVisible(false);
      }
  };

  // var [isDeviceInDatabase, setIsDeviceInDatabase] = useState(false);
  const [ChargerStatus, setChargerStatus] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [checkFault, setCheckFault] = useState(false);
  const [historys, setHistory] = useState([]);
  // const [errorCode, setErrorCode] = useState('');
  const [voltage, setVoltage] = useState(0);
  const [current, setCurrent] = useState(0);
  const [power, setPower] = useState(0);
  const [energy, setEnergy] = useState(0);
  const [frequency, setFrequency] = useState(0);
  const [temperature, setTemperature] = useState(0);

  useEffect(() => {
    const textBox = document.getElementById('chargerID');

    if (!ChargerID) {
      const appendedValue = 'Please enter a valid URL';
      textBox.value += appendedValue;
    } else {
      textBox.value += ChargerID;
    }
  }, [ChargerID]);

  useEffect(() => {
    const fetchLastStatus = async () => {
      try {
        const response = await fetch('http://192.168.1.70:8052/FetchLaststatus', {
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

    fetchLastStatus();
  }, [ChargerID]);

  const [socket, setSocket] = useState(null);

  // Effect to handle WebSocket connection
  useEffect(() => {
    // Check if the socket is not already open and ChargerID is provided
    if (!socket && ChargerID) {
      const newSocket = new WebSocket('ws://122.166.210.142:8050');

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
              //setErrorCode('NoError'); // Use state to manage errorCode
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
      const response = await fetch('http://192.168.1.70:8052/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: ChargerID }),
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
      const response = await fetch('http://192.168.1.70:8052/stop', {
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
      const response = await fetch('http://192.168.1.70:8052/getUpdatedCharingDetails', {
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
        setSearchChargerID('');
        setChargerID('');
        document.getElementById('searchBoxSection').style.display = 'block';
        document.getElementById('statusSection').style.display = 'none';
        fetchWallletBal(Username);
      } else {
        // Log or handle error
        console.error('Update failed:', response.statusText);
      }
    } catch (error) {
      // Log or handle error
      console.error('Update failed:', error.message);
    }
  };
  const [showAlert, setShowAlert] = useState(false);
  const [chargingSession, setChargingSession] = useState({});
  const [updatedUser, setUpdatedUser] = useState({});

  const setApiData = (chargerSession,uservalue) => {
    console.log(uservalue);
    setChargingSession(chargerSession);
    setUpdatedUser(uservalue);
    setShowAlert(true);
  };

  const handleCloseAlert = () => {
    setShowAlert(false);
  };

  // Get table data
  useEffect(() => {
    // Define the API URL based on the event detail
    const url = `http://192.168.1.70:8052/GetAllChargerDetails`;
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

  return (
    <div>
      {/* Navbar */}
      <nav className="navbar navbar-expand-lg navbar-light bg-light">
        <span className="navbar-brand">EV Power</span>
        <button className="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav" aria-controls="navbarNav" aria-expanded="false" aria-label="Toggle navigation">
          <span className="navbar-toggler-icon"></span>
        </button>
        <div className="collapse navbar-collapse" id="navbarNav">
          <ul className="navbar-nav ml-auto">
            {/* Logout Form in Navbar */}
            <li className="nav-item">
              <form className="form-inline" onClick={handleLogout}>
                <button type="button" className="btn btn-danger">Logout</button>
              </form>
            </li>
          </ul>
        </div>
      </nav>
      {/* Container for Page Content */}
      <div className="container mt-4">
        <div className="col-md-12">
          <blockquote className="blockquote">
            <div className="row">
              <div className="col-md-6 mb-2">
                <h2 style={{ paddingTop: '10px' }}>
                  <strong>Welcome </strong> <span className="text-primary">{Username},</span>
                </h2>
              </div>
              <div className="col-md-6 mb-2 pr-3">
                <button type="submit" className=" button-90 float-end" id="backSection" style={{ display: 'none' }} onClick={handleSearchBox}>Back</button>
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
                <div className="container" style={{textAlign:'center'}}>
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
                    <div className="col-12 col-sm-4">
                      <div className="container mt-3">
                        <h2 className="card-title">Recharge Wallet</h2>
                        <form action="http://192.168.1.70:8052/pay" method="get" className="d-flex flex-column">
                          <div className="d-flex justify-content-center">
                            <button type="submit" value="500" name="amount" className="button-45 mr-2">Rs.500</button>
                            <button type="submit" value="1000" name="amount" className="button-45 mr-2">Rs.1000</button>
                            <button type="submit" value="2000" name="amount" className="button-45">Rs.2000</button>
                          </div>
                          <input type="text" name="RCuser" value={Username} style={{ display: 'none' }} readOnly/>
                        </form>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </blockquote>
        </div>
        {/* Wallet Section stop */}

        {/* Charger Search Box and charger list table Section  start */}
        <div id="searchBoxSection">
          <div className="col-md-12" >
            <blockquote className="blockquote">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title" style={{textAlign: 'center'}}>SEARCH DEVICE</h2>
                  <form onSubmit={handleSearchRequest}>
                    {/* <div className="form-group">
                      <input type="text" className="form-control" id="chargerID" name="chargerID" value={searchChargerID} onChange={(e) => setChargerID(e.target.value)} placeholder="Enter ChargerID" />
                    </div>
                    <button type="submit" className="btn btn-primary">Search</button> */}
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
                    <div className="form-group" style={{ width: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <input type="text" style={{textAlign: 'center'}} className="form-control" id="chargerID" name="chargerID" value={searchChargerID} onChange={(e) => setChargerID(e.target.value)} placeholder="Enter DeviceID" />
                        <button type="submit" className="button-90" style={{marginTop: '10px'}}>Search</button>
                      </div>                    
                    </div>
                  </form>
                </div>
              </div>
            </blockquote>
          </div>
          {/* charger list */}
          <div className="col-md-12" >
            <blockquote className="blockquote">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title">Charger list</h2>
                  <div className="table-container">
                    <table className="table table-striped" style={{textAlign:'center'}}>
                      <thead>
                        <tr>
                          <th>Sl.No</th>
                          <th>DeviceID</th>
                          <th>Status</th>
                          <th>Type</th>
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
                              <tr key={index}>
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
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan="5" style={{ marginTop: '50px', textAlign: 'center' }}>No devices found.</td>
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
        {/* Charger Search Box and charger list table Section stop */}

        {/* Charger status Section  start*/}
        <div className="col-md-12" id="statusSection" style={{ display: 'none' }}>
          <blockquote className="blockquote">
            <div className="card">
              <div className="card-body">
                <div style={{textAlign: 'center'}}>
                  <h2 className="card-title text-primary">CHARGER STATUS</h2>
                  <h5>{ChargerStatus}</h5>
                  <h5>{timestamp}</h5>
                  <h5 className="text-primary">{ChargerID}</h5>
                </div>
                <div className="container" style={{ paddingTop:'20px' ,paddingBottom: '20px', textAlign: 'center'}}>
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
                  <div className="row justify-content-around" style={{textAlign:'center'}}>
                    <div className="col-12 col-sm-5">
                      <div className="container mt-4">
                        <button type="submit" className="btn btn-success " onClick={handleStartTransaction} disabled={ChargerStatus !== 'Preparing'} id="startTransactionBtn" style={{width:'40%', borderRadius: '20px'}}><b>Start</b></button>    
                      </div>
                    </div>
                    <div className="col-12 col-sm-5">
                      <div className="container mt-4">
                        <button type="submit" className="btn btn-danger" onClick={handleStopTransaction} disabled={ChargerStatus !== 'Charging'} id="stopTransactionBtn" style={{width:'40%', borderRadius: '20px'}}><b>Stop</b></button>                        
                      </div>
                    </div>
                  </div>
                </div>
                <div style={{textAlign: 'center', paddingTop:"20px"}}>
                  <button type="submit" className=" button-90" onClick={toggleTableVisibility}>
                    <span>{isTableVisible ? 'Hide Error History' : 'Show Error History'}</span>
                  </button>
                </div>
                {isTableVisible && (
                  <div className="col-lg-12 grid-margin stretch-card" style={{paddingTop:'20px'}}>
                    <div className="card">
                      <div className="card-body">
                        <div className="table-container">
                          <table className="table table-striped" style={{textAlign:'center'}}>
                            <thead>
                              <tr>
                                <th>Sl.No</th>
                                <th>Timestamp</th>
                                <th>Status</th>
                                <th>Error</th>
                              </tr>
                            </thead>
                            <tbody>
                              {historys.map((entry) => (
                                <tr key={entry.serialNumber}>
                                  <td>{entry.serialNumber}</td>
                                  <td>{entry.currentTime}</td>
                                  <td>{entry.chargerStatus}</td>
                                  <td>{entry.errorCode}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="col-md-12 grid-margin stretch-card" style={{paddingTop:'20px'}}>
                  <div className="">
                    <div className="card-body">
                      <div className="row">
                        <div className="col-12 card" style={{backgroundColor:'rgb(232 239 96 / 67%)', borderRadius:'30px'}}>
                          <div className="table-responsive">
                            <div className="danger" style={{paddingLeft: '10px', paddingBottom:'5px', color: 'black'}}>
                              <h4 style={{paddingTop:'20px'}}><u>THRESHOLD LEVEL:</u></h4>
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
        {/* Alert charger update Session Price To User start*/}
        <div>
        {/* Your API call logic and setApiData usage go here */}
        {/* Alert Box */}
        {showAlert && (
          <div className="alert-overlay">
            <div className="alert success" style={{width:'500px'}}>
              <span className="alertClose" onClick={handleCloseAlert}>X</span>
              <span className="alertText"><p><strong>ChargerID:</strong> {chargingSession.ChargerID}</p></span>
              <span className="alertText"><p><strong>Start Time:</strong> {chargingSession.StartTimestamp}</p></span>
              <span className="alertText"><p><strong>Stop Time:</strong> {chargingSession.StopTimestamp}</p></span>
              <span className="alertText"><p><strong>Unit Consumed:</strong> {chargingSession.Unitconsumed}</p></span>
              <span className="alertText"><p><strong>Charging Price:</strong> {chargingSession.price}</p></span>
              <span className="alertText"><p><strong>Available Balance:</strong> {updatedUser.walletBalance}</p></span>
            </div>
          </div>
        )}
        {/* Rest of your component */}
        </div>
        {/* Alert charger update Session Price To User stop*/}
      </div>
        {/* Alert message */}
        {errorData && (
          // <div className="alert-overlay" style={{textAlign:'center'}}>
          //   <div className="alert success" style={{width:'500px', backgroundColor:'#ffeeba', borderRadius:'10px'}}>
          //     <span className="alertClose" onClick={closeAlert}>X</span>
          //     <span className="alertText"><h6>{errorData.message}</h6></span>
          //   </div>
          // </div>
          <div class="alert alert-warning alert-dismissible fade show alert-container" role="alert" style={{width:'500px', textAlign:'center'}}>
            <strong>{errorData.message}</strong> 
            <button type="button" class="close" data-dismiss="alert" aria-label="Close" onClick={closeAlert} style={{top:'7px'}}>
              <span aria-hidden="true">&times;</span>
            </button>
          </div>
        )}
        {/* Alert message  */}
    </div>
  );
};

export default Home;