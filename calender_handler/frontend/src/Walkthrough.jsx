export default function Walkthrough() {
  return (
    <div className="Walkthrough">
        <h1>Get Canvas Connected!</h1>
        <ul>
          <li>Go to <a href="https://canvas.instructure.com/accounts/self/registrations/new" target="_blank" rel="noopener noreferrer">https://canvas.instructure.com/accounts/self/registrations/new</a> and create a free account.</li>
          <li>Once you have an account, click on your profile picture in the top right corner and select "Settings".</li>
          <li>Scroll down to the "Approved Integrations" section and click on "New Access Token".</li>
          <li>Give your token a name (e.g., "Canvas API Token") and set an expiration date if desired, then click "Generate Token".</li>
          <li>Copy the generated token and paste it into the input field below to connect your Canvas account.</li>
        </ul>
    </div>
  );
}