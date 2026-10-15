import React from "react";
import { NavLink } from "react-router-dom";

function SideBar() {
  return (
    <ul className="SideNav">
      <li className="SideNav-item">
        <NavLink
          className={({ isActive }) => `SideNav-itemLink ${isActive ? "is-selected" : ""}`}
          aria-current="page"
          to="/dashboard"
        >
          Dashboard
        </NavLink>
      </li>
      <li className="SideNav-item">
        <NavLink
          className={({ isActive }) => `SideNav-itemLink ${isActive ? "is-selected" : ""}`}
          aria-current="page"
          end
          to="/"
        >
          Products
        </NavLink>
      </li>
      <li className="SideNav-item">
        <NavLink
          className={({ isActive }) => `SideNav-itemLink ${isActive ? "is-selected" : ""}`}
          aria-current="page"
          to="/orders"
        >
          Orders
        </NavLink>
      </li>
      <li className="SideNav-item">
        <NavLink
          className={({ isActive }) => `SideNav-itemLink ${isActive ? "is-selected" : ""}`}
          aria-current="page"
          to="/customers"
        >
          Customers
        </NavLink>
      </li>
      <li className="SideNav-item">
        <NavLink
          className={({ isActive }) => `SideNav-itemLink ${isActive ? "is-selected" : ""}`}
          aria-current="page"
          to="/categories"
        >
          Categories
        </NavLink>
      </li>
      <li className="SideNav-item">
        <NavLink
          className={({ isActive }) => `SideNav-itemLink ${isActive ? "is-selected" : ""}`}
          aria-current="page"
          to="/indexing"
        >
          Indexing
        </NavLink>
      </li>
      <li className="SideNav-item">
        <NavLink
          className={({ isActive }) => `SideNav-itemLink ${isActive ? "is-selected" : ""}`}
          aria-current="page"
          to="/commands"
        >
          Command Manager
        </NavLink>
      </li>
      <li className="SideNav-item">
        <NavLink
          className={({ isActive }) => `SideNav-itemLink ${isActive ? "is-selected" : ""}`}
          aria-current="page"
          to="/admin-users"
        >
          Admin Users
        </NavLink>
      </li>
    </ul>
  );
}

export default SideBar;
