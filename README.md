# Langkah Sukses Pintar Affiliate Hub

## Purpose

The Langkah Sukses Pintar Affiliate Hub is a simple web application designed to allow affiliates of 'Langkah Sukses Pintar' to generate unique tracking links and view basic performance metrics, including clicks and imported conversion data.

## Features

*   **Affiliate Link Generation:** Create short, unique affiliate links that redirect to a specified target URL.
*   **Basic Click Tracking:** Tracks the number of clicks and unique IP addresses per day for each generated link.
*   **Conversion Data Import:** Allows administrators to import conversion data for affiliates via CSV files.
*   **Basic Commission Info:** Displays total conversions per affiliate ID based on imported data.
*   **Password Protected Dashboard:** A simple shared password protects access to the affiliate dashboard.

## Technologies Used

*   **Frontend:** Astro.js (with vanilla JavaScript for client-side interactions)
*   **Backend:** Node.js (using the native `http` module for the server)
*   **Database:** SQLite
*   **Data Import Format:** CSV for conversion data.

## Folder Structure

*   `/frontend`: Contains the Astro.js frontend application.
    *   `src/pages`: Astro pages (e.g., login, dashboard).
    *   `src/layouts`: Astro layout components.
    *   `src/styles`: Global CSS files.
*   `/backend`: Contains the Node.js backend server, data, and scripts.
    *   `data/`: Stores the SQLite database (`database.db`).
    *   `import_data/`: Directory for placing CSV files for conversion import.
*   `/docs`: Placeholder for future detailed documentation.

## Setup and Running Instructions

### Prerequisites

*   Node.js (version 18.x or higher recommended)
*   npm (Node Package Manager, typically comes with Node.js)

### Backend Setup

1.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Set the Shared Password:**
    Open `backend/config.json`. Change the default `sharedPassword` to a secure password of your choice. This password will be used to log in to the dashboard.
    ```json
    {
      "sharedPassword": "your_new_secure_password_here"
    }
    ```
4.  **Initialize the Database:**
    This step creates the `backend/data/database.db` file and sets up the necessary tables.
    ```bash
    node setup_database.js
    ```
5.  **Start the Backend Server:**
    ```bash
    node server.js
    ```
    The backend server typically runs on `http://localhost:3000`. You should see a confirmation message in the console.

### Frontend Setup

1.  **Navigate to the frontend directory (from the project root):**
    ```bash
    cd frontend
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Start the Frontend Development Server:**
    ```bash
    npm run dev
    ```
    The frontend development server usually runs on `http://localhost:4321`.

### Accessing the Application

1.  Open a web browser and navigate to the frontend URL (e.g., `http://localhost:4321`).
2.  You will be redirected to the login page.
3.  Enter the shared password you configured in `backend/config.json`.
4.  Upon successful login, you will be taken to the affiliate dashboard.

## Importing Conversion Data

Conversion data (e.g., number of successful sales attributed to an affiliate) can be imported into the system using a CSV file.

1.  **Prepare your CSV file.** The format must be `affiliate_id,total_conversion` with a header row.
    Example (`my_conversions.csv`):
    ```csv
    affiliate_id,total_conversion
    affiliate001,15
    another_user,20
    affiliate001,5
    ```
    *Note: The import script will sum `total_conversion` values if an `affiliate_id` appears multiple times in the CSV or already exists in the database from a previous import.*

2.  **Place the CSV file** in the `backend/import_data/` directory. For example, `backend/import_data/my_conversions.csv`.

3.  **Stop the backend server** if it is currently running (Ctrl+C in the terminal where it's running).

4.  **Run the import script** from the `backend` directory:
    ```bash
    cd backend
    node import_conversions.js import_data/my_conversions.csv
    ```
    Replace `import_data/my_conversions.csv` with the actual path to your file relative to the `backend` directory.

5.  **Restart the backend server:**
    ```bash
    node server.js
    ```
    The newly imported conversion data will now be reflected in the "Total Conversions" column for the respective links on the dashboard and in the "Commission Summary" section.

## Database Structure (Brief)

The application uses an SQLite database stored in `backend/data/database.db`.

*   **`affiliate_links`**: Stores the generated affiliate links.
    *   `id`: Primary key.
    *   `target_url`: The original URL the affiliate link redirects to.
    *   `unique_code`: The short unique code used in the affiliate link.
    *   `affiliate_id`: An optional identifier for the affiliate or campaign.
*   **`click_logs`**: Logs each click on an affiliate link.
    *   `id`: Primary key.
    *   `link_id`: Foreign key referencing `affiliate_links.id`.
    *   `ip_address`: The IP address of the clicker (used for unique click counting).
    *   `timestamp`: Date and time of the click.
*   **`conversions`**: Stores imported conversion data.
    *   `id`: Primary key.
    *   `affiliate_id`: The unique identifier for the affiliate (matches `affiliate_id` in `affiliate_links`). This is UNIQUE.
    *   `total_conversion`: The number of conversions for that affiliate. This is updated by the import script.

## Example Data File Structures

*   **`backend/data/database.db`**: This is a binary SQLite database file. It is created when you run `node backend/setup_database.js`.

*   **`backend/config.json`**: Stores the shared password for dashboard access.
    ```json
    {
      "sharedPassword": "your_secure_password_here"
    }
    ```

*   **`backend/import_data/sample_conversions.csv` (Example):** This is an example of a CSV file you might use for importing conversion data.
    ```csv
    affiliate_id,total_conversion
    affiliate001,100
    affiliate002,250
    user123,75
    ```
---

This `README.md` provides a good overview for users and developers.
The `/docs` directory will remain empty for now but can be used for more detailed technical or API documentation in the future.
