import React from 'react';
import { Link } from 'react-router-dom';

const Sidebar  = () => {

    return (
        //  partial:partials/_sidebar
        <nav className="sidebar sidebar-offcanvas" id="sidebar">
            <ul className="nav">
            <li className="nav-item active">
                <Link className="nav-link" to="chargerDashboard">
                <i className="icon-grid menu-icon"></i>
                <span className="menu-title">Dashboard</span>
                </Link>
            </li>
            {/*  <li className="nav-item">
                <a className="nav-link" data-toggle="collapse" href="#ui-basic" aria-expanded="false" aria-controls="ui-basic">
                <i className="icon-layout menu-icon"></i>
                <span className="menu-title">UI Elements</span>
                <i className="menu-arrow"></i>
                </a>
                <div className="collapse" id="ui-basic">
                <ul className="nav flex-column sub-menu">
                    <li className="nav-item"> <a className="nav-link" href="pages/ui-features/buttons.html">Buttons</a></li>
                    <li className="nav-item"> <a className="nav-link" href="pages/ui-features/dropdowns.html">Dropdowns</a></li>
                    <li className="nav-item"> <a className="nav-link" href="pages/ui-features/typography.html">Typography</a></li>
                </ul>
                </div>
            </li>  */}
            </ul>
        </nav>
    );
};
export default Sidebar
