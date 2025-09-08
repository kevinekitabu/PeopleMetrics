# **DataStreamHr**

**DataStreamHr** is a next-generation SaaS solution designed to empower HR teams with actionable insights, simplifying employee performance management, and enhancing decision-making processes. With DataStreamHr, HR professionals can seamlessly analyze attendance, performance, timesheets, and feedback to make informed decisions.

---

## **Features**

- **Data Upload & Processing**: Upload Excel files for attendance, performance, and timesheets to get instant analytics.
- **AI-Driven Insights**: Leverage advanced AI models to analyze feedback, identify trends, and provide recommendations.
- **Interactive Dashboards**: Visualize employee performance, attendance patterns, and sentiment trends with easy-to-use charts and graphs.
- **Role-Based Access**: Securely manage user access with role-based authentication.
- **Mobile-Ready API**: Extend functionality to Android and iOS apps for on-the-go HR management.

---

## **Core Use Cases**

1. **Performance Analysis**: Evaluate employee performance metrics and trends for informed decision-making.
2. **Attendance Monitoring**: Track attendance patterns, flag absenteeism, and manage time effectively.
3. **Raise Recommendations**: Identify top performers for raises or promotions using predictive analytics.
4. **Feedback Sentiment Analysis**: Automatically categorize and assess feedback to address concerns effectively.

---

## **Getting Started**

### **System Requirements**
- Node.js 16+
- React.js (for frontend)
- PostgreSQL (for database)
- Supabase (for authentication and backend services)

### **Installation**

1. Clone the repository:
   ```bash
   git clone https://github.com/your-organization/datastreamhr.git
   cd datastreamhr
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   - Create a `.env` file in the root directory.
   - Add the following variables:
     ```
     VITE_SUPABASE_URL=<your-supabase-url>
     VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
     ```

4. Start the development server:
   ```bash
   npm start dev
   ```

5. Access the application:
   - Open your browser and navigate to `http://localhost:5173`.

---

## **Project Setup**

### **Supabase Configuration**
1. Log in to [Supabase](https://supabase.com/) and create a new project.
2. Copy the project URL and API keys from the Supabase dashboard.
3. Add these values to the `.env` file as shown above.

### **Database Setup**
1. Ensure PostgreSQL is installed and running.
2. Create a new database for the project.
3. Update the database connection string in your Supabase configuration.

### **Frontend Setup**
1. Ensure all dependencies are installed using `npm install`.
2. Use `npm start` to run the React development server.
