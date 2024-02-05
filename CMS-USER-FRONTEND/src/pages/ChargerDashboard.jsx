import React, { useState, useEffect} from 'react';
import Header from '../components/Header';
import Sidebar from '../components/Sidebar';
import Footer from '../components/Footer';
// import {Link } from 'react-router-dom'; 

const ChargerDashboard = ({ Username, handleLogout, ChargerID }) => {
  const [isTableVisible, setIsTableVisible] = useState(false);
  const toggleTableVisibility = () => {
    setIsTableVisible(!isTableVisible);
  };
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [apiData, setApiData] = useState(null);

  const closeDialog = () => {
    setDropdownVisible(false);
  };
  const [isDeviceInDatabase, setIsDeviceInDatabase] = useState(false);
  const [ChargerStatus, setChargerStatus] = useState('');
  const [timestamp, setTimestamp] = useState('');
  const [checkFault, setCheckFault] = useState(false);
  const [history, setHistory] = useState([]);
  // const [serialNumber, setSerialNumber] = useState('');
  // const [CurrentTime, setCurrentTime] = useState('');
  // const [ChargerStatus2, setChargerStatus2] = useState('');
  // const [errorCode, setErrorCode] = useState('');
  const [errorCode, setErrorCode] = useState('');

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

    console.log('Ready!');
    setIsDeviceInDatabase(true);
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
          // setTimestamp(formattedTimestamp);
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

  useEffect(() => {
    const socket = new WebSocket('ws://122.166.210.142:8050');

    socket.addEventListener('open', (event) => {
      console.log('WebSocket connection opened:', event);
    });

    socket.addEventListener('message', (response) => {
      const parsedMessage = JSON.parse(response.data);
      let ChargerStatus;
      let CurrentTime;
      let errorCode;
      let user = Username;
      const { DeviceID, message } = parsedMessage;

      if (isDeviceInDatabase && DeviceID === ChargerID) {
        switch (message[2]) {
          case 'StatusNotification':
            ChargerStatus = message[3].status;
            CurrentTime = formatTimestamp(message[3].timestamp);
            errorCode = message[3].errorCode;
            console.log(`ChargerID ${DeviceID}: {"status": "${ChargerStatus}","time": "${CurrentTime}","error": "${errorCode}"}`);

            // Update state variables to maintain the history
            if (errorCode !== 'NoError') {
              setHistory((history) => [
                ...history,
                {
                  serialNumber: history.length + 1,
                  currentTime: CurrentTime,
                  chargerStatus: ChargerStatus,
                  errorCode: errorCode,
                },
              ]);
              // setSerialNumber(String(history.length + 1));
              // setCurrentTime(CurrentTime);
              // setChargerStatus2(ChargerStatus);
              // setErrorCode(errorCode);
              // setCheckFault(true);
            } else {
              setCheckFault(false);
            }
            break;

          case 'Heartbeat':
            CurrentTime = getCurrentTime();
            setTimestamp(CurrentTime);
            break;

            case 'MeterValues':
              setErrorCode('NoError'); // Use state to manage errorCode
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
              console.log(`{ "V": ${updatedValues.voltage},"A": ${updatedValues.current},"W": ${updatedValues.power},"Wh": ${updatedValues.energy},"Hz": ${updatedValues.frequency},"Kelvin": ${updatedValues.temperature}
            }`);
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
    });

    socket.addEventListener('close', (event) => {
      console.log('WebSocket connection closed:', event);
    });

    socket.addEventListener('error', (event) => {
      console.error('WebSocket error:', event);
    });
  // }, [ChargerID, isDeviceInDatabase]);
  }, [ChargerID, isDeviceInDatabase, Username, checkFault, history.length]);


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

        // Set the state to make the dropdown visible
        setDropdownVisible(true);

        // Other data processing

        // Set the API data for rendering in the dropdown
        setApiData({
          chargerID: chargingSession.ChargerID,
          startTime: chargingSession.StartTimestamp,
          stopTime: chargingSession.StopTimestamp,
          unitConsumed: chargingSession.Unitconsumed,
          chargingPrice: chargingSession.price,
          username: chargingSession.user,
          availableBalance: updatedUser.walletBalance,
        });

      } else {
        // Log or handle error
        console.error('Update failed:', response.statusText);
      }
    } catch (error) {
      // Log or handle error
      console.error('Update failed:', error.message);
    }
  };
  return (
    <div className="container-scroller">
    {/* <!-- partial:partials/_navbar.html --> */}
    <Header />
    {/* partial */}
    <div className="container-fluid page-body-wrapper">
      {/* partial */}
      {/* partial:partials/_sidebar.html */}
      <Sidebar />
      {/* partial */}
      <div className="main-panel">
        <div className="content-wrapper">
          <div className="d-flex justify-content-between">
            <h3 className="font-weight-bold">Welcome <span className="text-primary">{Username}</span></h3>
            <button type="button" className="btn btn-danger" onClick={handleLogout}>Logout</button>
          </div> <hr></hr>
          <div className="row">
            <div className="col-md-12 grid-margin stretch-card" style={{textAlign:'center'}}>
              <div className="card">
                <div className="card-body">
                  <blockquote className="blockquote">
                    <p className="text-primary"><span style={{fontSize:'x-large'}}>CHARGER STATUS</span></p>
                    <p><span style={{fontSize:'x-large'}}>{ChargerStatus}</span></p>
                    <p><span style={{fontSize:'x-large'}}>{timestamp}</span></p>
                    <h3 style={{margin: 'auto', width: '100%', padding: '10px'}}>
                      <input type="text" id="chargerID" className="text-primary" style={{width: '100%', textAlign: 'center'}}  readOnly/>
                    </h3>
                  </blockquote>
                </div>
              </div>
            </div>
            <div className="col-md-4 grid-margin stretch-card">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title" style={{textAlign: 'center', paddingTop: '25px'}}>Voltage : <span>{voltage}</span></h2>
                </div>
              </div>
            </div>
            <div className="col-md-4 grid-margin stretch-card">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title"  style={{textAlign: 'center', paddingTop: '25px'}}>Current : <span>{current}</span></h2>
                </div>
              </div>
            </div>
            <div className="col-md-4 grid-margin stretch-card">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title"  style={{textAlign: 'center', paddingTop: '25px'}}>Power : <span>{power}</span></h2>
                </div>
              </div>
            </div>
            <div className="col-md-4 grid-margin stretch-card">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title"  style={{textAlign: 'center', paddingTop: '25px'}}>Energy : <span>{energy}</span></h2>
                </div>
              </div>
            </div>
            <div className="col-md-4 grid-margin stretch-card">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title"  style={{textAlign: 'center', paddingTop: '25px'}}>Frequency : <span>{frequency}</span></h2>
                </div>
              </div>
            </div>
            <div className="col-md-4 grid-margin stretch-card">
              <div className="card">
                <div className="card-body">
                  <h2 className="card-title"  style={{textAlign: 'center', paddingTop: '25px'}}>Temperature : <span>{temperature}</span></h2>
                </div>
              </div>
            </div>
          </div>
          <div className="col-12 grid-margin stretch-card">
            <div className="card">
              <div className="row">
                <div className="col-md-6">
                  <div className="card-body" style={{ textAlign: 'center', paddingTop: '25px' }}>
                    <button type="button" className="btn btn-success btn-sm" onClick={handleStartTransaction} disabled={ChargerStatus !== 'Preparing'}>
                      <span style={{ fontSize: '30px' }} id="startTransactionBtn"><b>START</b></span>
                    </button>
                  </div>
                </div>
                <div className="col-md-6">
                  <div className="card-body" style={{ textAlign: 'center', paddingTop: '30px' }}>
                    <button type="button" className="btn btn-danger btn-sm" onClick={handleStopTransaction} disabled={ChargerStatus !== 'Charging'}>
                      <span style={{ fontSize: '30px' }} id="stopTransactionBtn"><b>STOP</b></span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="col-md-12">
            <div className="card-body" style={{textAlign: 'center', paddingTop:'30px'}}>
              <button type="button" className="btn btn-primary btn-sm btn-show-error-history"  onClick={toggleTableVisibility}>
                <span style={{fontSize:'30px'}}><b>{isTableVisible ? 'Hide Error History' : 'Show Error History'}</b></span>
              </button>
            </div>
          </div>
          {isTableVisible && (
          <div className="col-lg-12 grid-margin stretch-card table-responsive-click">
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
                      {history.map((entry) => (
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
          <div className="col-md-12 grid-margin stretch-card">
            <div className="card">
              <div className="card-body">
                <p className="card-title">Note:</p>
                <div className="row">
                  <div className="col-12 card card-light-danger">
                    <div className="table-responsive">
                      <div className="danger" style={{paddingLeft: '10px', paddingBottom:'5px', color: 'black'}}>
                        <h4 style={{paddingTop:'20px'}}><u>Threshold Level</u></h4>
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
          {/* getUpdatedCharingDetails start */}
          <div>
            {dropdownVisible && apiData && (
              <dialog open>
                <div className="container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', margin: '0' }}>
                  <div className="alert" style={{ padding: '20px', backgroundColor: '#0deb05', color: 'white', width: '50%', textAlign: 'center' }}>
                    <span className="closebtn" onClick={closeDialog} style={{ marginLeft: '15px', color: 'white', fontWeight: 'bold', float: 'right', fontSize: '22px', lineHeight: '20px', cursor: 'pointer', transition: '0.3s' }}>&times;</span>
                    <p><strong>ChargerID</strong>{apiData.chargerID}</p>
                    <p><strong>Start Time</strong>{apiData.startTime}</p>
                    <p><strong>Stop Time</strong>{apiData.stopTime}</p>
                    <p><strong>Unit Consumed</strong>{apiData.unitConsumed}</p>
                    <p><strong>Charging Price</strong>{apiData.chargingPrice}</p>
                    <p><strong>Username</strong>{apiData.username}</p>
                    <p><strong>Available Balance</strong>{apiData.availableBalance}</p>
                  </div>
                </div>
              </dialog>
            )}
          </div>
          {/* getUpdatedCharingDetails stop */}
        </div>
        {/*  content-wrapper ends  */}
        {/*  partial:partials/_footer */}
        <Footer />
        {/*  partial */}
      </div>
      {/* main-panel ends */}
    </div>   
    {/* page-body-wrapper ends */}
  </div>
 
  )
}

export default ChargerDashboard
