<template>
  <div class="dashboard">
    <header class="dashboard-header">
      <h1>Dashboard</h1>
      <div class="header-actions">
        <button class="btn btn-primary">Export</button>
      </div>
    </header>

    <div class="dashboard-grid">
      <div class="card">
        <div class="card-header">
          <h3>Total Revenue</h3>
        </div>
        <div class="card-content">
          <p class="metric">$45,231.89</p>
          <p class="change positive">+12.5% from last month</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Active Users</h3>
        </div>
        <div class="card-content">
          <p class="metric">2,543</p>
          <p class="change positive">+8.2% from last month</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Total Orders</h3>
        </div>
        <div class="card-content">
          <p class="metric">1,234</p>
          <p class="change negative">-3.1% from last month</p>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <h3>Conversion Rate</h3>
        </div>
        <div class="card-content">
          <p class="metric">3.24%</p>
          <p class="change positive">+1.2% from last month</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: "Dashboard",
  data() {
    return {};
  },
};
</script>

<style scoped>
.dashboard {
  padding: 2rem;
  background: #f5f7fa;
  min-height: 100vh;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.dashboard-header h1 {
  font-size: 2rem;
  color: #1a202c;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  border: none;
  border-radius: 0.5rem;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
}

.btn-primary {
  background: #3b82f6;
  color: white;
}

.btn-primary:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
}

.card {
  background: white;
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
}

.card:hover {
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  transform: translateY(-4px);
}

.card-header h3 {
  font-size: 0.875rem;
  color: #6b7280;
  font-weight: 500;
  margin: 0;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.card-content {
  margin-top: 1rem;
}

.metric {
  font-size: 2rem;
  color: #1a202c;
  font-weight: 700;
  margin: 0.5rem 0;
}

.change {
  font-size: 0.875rem;
  margin: 0;
}

.change.positive {
  color: #10b981;
}

.change.negative {
  color: #ef4444;
}
</style>
