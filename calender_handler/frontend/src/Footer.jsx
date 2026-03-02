import React, { Component } from "react";
import { createUseStyles } from "react-jss";

const useStyles = createUseStyles({
  footer: {
    padding: "1rem",
    textAlign: "center",
    backgroundColor: "#f0f0f0",
    borderTop: "1px solid #ccc",
  },
});

export default function Footer() {
  const classes = useStyles();
  return (
    <footer className={classes.footer}>
      <h5>Need help getting your calendar set up? Check out the <a href="https://example.com/help">help guide</a>.</h5>
    </footer>
    );
}

