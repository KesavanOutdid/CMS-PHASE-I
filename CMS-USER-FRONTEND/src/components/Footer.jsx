import React from 'react'
import { Link } from 'react-router-dom/cjs/react-router-dom.min';

const Footer  = () => {
    const year = new Date();
    return (
        <footer className="footer">
            <div className="d-sm-flex justify-content-center justify-content-sm-between">
                <span className="text-muted text-center text-sm-left d-block d-sm-inline-block"> Copyright &copy; {year.getFullYear()}  <Link to="#" target="_blank">EV Power</Link></span>
            </div>
        </footer> 
    )
}

export default Footer
