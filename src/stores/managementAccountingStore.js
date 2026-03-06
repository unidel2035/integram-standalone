/**
 * Management Accounting Agent Store
 *
 * Manages budget data including plan/fact analysis, payroll (FOT), costs, and organization structure.
 * Based on the financial model from FM_09.xlsx and Auto_ver_09.docx requirements.
 */

import { defineStore } from 'pinia'

export const useManagementAccountingStore = defineStore('managementAccounting', {
  state: () => ({
    // Summary data
    summary: {
      capex: 2850, // Capital expenses in thousands
      opex: 3231.7, // Operational expenses in thousands
      ebitda: 2349.41, // EBITDA in thousands
      plannedRevenue: 11367.31, // Planned revenue in thousands
      totalPayroll: 2677.07, // Total FOT in thousands
      depositedBonus: 164.76 // Deposited bonus in thousands
    },

    // Monthly plan/fact data (months 5-12 from Excel)
    monthlyData: [
      { month: 'May', revenuePlan: 2124.03, revenueFact: 0, ebitdaPlan: 2124.03, ebitdaFact: 0, cfPlan: 2124.03, cfFact: 0, variance: -100 },
      { month: 'June', revenuePlan: 2124.03, revenueFact: 0, ebitdaPlan: 2124.03, ebitdaFact: 0, cfPlan: 4248.05, cfFact: 0, variance: -100 },
      { month: 'July', revenuePlan: 2124.03, revenueFact: 0, ebitdaPlan: 2124.03, ebitdaFact: 0, cfPlan: 6372.08, cfFact: 0, variance: -100 },
      { month: 'August', revenuePlan: 2124.03, revenueFact: 0, ebitdaPlan: 2124.03, ebitdaFact: 0, cfPlan: 8496.10, cfFact: 0, variance: -100 },
      { month: 'September', revenuePlan: 2124.03, revenueFact: 0, ebitdaPlan: 2124.03, ebitdaFact: 0, cfPlan: 10620.13, cfFact: 0, variance: -100 },
      { month: 'October', revenuePlan: 2124.03, revenueFact: 0, ebitdaPlan: 2124.03, ebitdaFact: 0, cfPlan: 12744.16, cfFact: 0, variance: -100 },
      { month: 'November', revenuePlan: 2124.03, revenueFact: 0, ebitdaPlan: 2124.03, ebitdaFact: 0, cfPlan: 14868.18, cfFact: 0, variance: -100 },
      { month: 'December', revenuePlan: 2124.03, revenueFact: 0, ebitdaPlan: 2124.03, ebitdaFact: 0, cfPlan: 16992.21, cfFact: 0, variance: -100 }
    ],

    // Payroll data by department (from FOT sheet)
    payrollData: [
      {
        department: 'Office (CFO)',
        constTotal: 450,
        constTax: 24.4,
        variableTotal: 460,
        bonusTotal: 45,
        total: 979.4,
        employees: [
          { position: 'General Director (GD)', constSalary: 190, tax: 6.8, variable: 210, bonus: 20, total: 426.8, premiumDescription: '7% from 3 million result' },
          { position: 'Accountant (outsourced)', constSalary: 50, tax: 0, variable: 20, bonus: 0, total: 70, premiumDescription: 'From 3 million result' },
          { position: 'Facility Manager', constSalary: 30, tax: 6.8, variable: 20, bonus: 5, total: 61.8, premiumDescription: 'From 3 million result' },
          { position: 'Cleaner (outsourced)', constSalary: 10, tax: 4, variable: 0, bonus: 0, total: 14, premiumDescription: '' },
          { position: 'Financial Director', constSalary: 150, tax: 6.8, variable: 210, bonus: 20, total: 386.8, premiumDescription: '7% from 3 million result' },
          { position: 'System Administrator (outsourced)', constSalary: 20, tax: 0, variable: 0, bonus: 0, total: 20, premiumDescription: '' }
        ]
      },
      {
        department: 'Commercial (CFO)',
        constTotal: 390,
        constTax: 47.6,
        variableTotal: 467,
        bonusTotal: 52,
        total: 956.6,
        employees: [
          { position: 'Commercial Director', constSalary: 150, tax: 6.8, variable: 150, bonus: 14, total: 320.8, premiumDescription: '5% from 3 million result' },
          { position: 'Sales Manager', constSalary: 20, tax: 6.8, variable: 40, bonus: 5, total: 71.8, premiumDescription: '6% from personal plan' },
          { position: 'Sales Manager', constSalary: 20, tax: 6.8, variable: 40, bonus: 5, total: 71.8, premiumDescription: '6% from personal plan' },
          { position: 'Marketer', constSalary: 20, tax: 6.8, variable: 90, bonus: 6, total: 122.8, premiumDescription: '3% from 3 million result' },
          { position: 'Service Manager', constSalary: 60, tax: 6.8, variable: 7, bonus: 6, total: 79.8, premiumDescription: '7000 from 1.5 million result' },
          { position: 'IT Specialist', constSalary: 100, tax: 6.8, variable: 90, bonus: 12, total: 208.8, premiumDescription: '3% from 3 million result' },
          { position: 'Logistics Specialist', constSalary: 20, tax: 6.8, variable: 50, bonus: 4, total: 80.8, premiumDescription: '' }
        ]
      },
      {
        department: 'Service (CFO)',
        constTotal: 375,
        constTax: 47.6,
        variableTotal: 108,
        bonusTotal: 34,
        total: 564.6,
        employees: [
          { position: 'Chief Engineer', constSalary: 25, tax: 6.8, variable: 50, bonus: 10, total: 91.8, premiumDescription: '50k from personal result' },
          { position: 'Service Administrator', constSalary: 60, tax: 6.8, variable: 6, bonus: 6, total: 78.8, premiumDescription: '6000 from personal result' },
          { position: 'Procurement Manager', constSalary: 20, tax: 6.8, variable: 45, bonus: 4, total: 75.8, premiumDescription: '5% personal' },
          { position: 'Warehouse Keeper', constSalary: 50, tax: 6.8, variable: 10, bonus: 4, total: 70.8, premiumDescription: '10k from 3 million result' },
          { position: 'Driver', constSalary: 25, tax: 6.8, variable: 5, bonus: 3, total: 39.8, premiumDescription: '5k from company result' },
          { position: 'Worker', constSalary: 35, tax: 6.8, variable: 5, bonus: 4, total: 50.8, premiumDescription: '5k from company result' },
          { position: 'Chief Mechanic', constSalary: 80, tax: 6.8, variable: 15, bonus: 6, total: 107.8, premiumDescription: '10k personal' },
          { position: 'Auto Electrician', constSalary: 50, tax: 6.8, variable: 6, bonus: 4, total: 66.8, premiumDescription: '6k personal' }
        ]
      }
    ],

    // Costs data by category (from Costs sheet)
    costsData: [
      {
        category: 'Office',
        opex: 25.5,
        capex: 1150,
        vat: 235.1,
        total: 1410.6,
        items: [
          { name: 'Office supplies/coffee', opex: 2, capex: 0, vat: 0.4 },
          { name: 'Mobile communication', opex: 3, capex: 0, vat: 0.6 },
          { name: 'Stationery', opex: 1, capex: 0, vat: 0.2 },
          { name: 'Transportation', opex: 1, capex: 0, vat: 0.2 },
          { name: 'Fuel', opex: 13, capex: 0, vat: 2.6 },
          { name: 'Equipment maintenance', opex: 2, capex: 0, vat: 0.4 },
          { name: 'Internet', opex: 0.5, capex: 0, vat: 0.1 },
          { name: 'Utilities (electrical/water)', opex: 0, capex: 1000, vat: 200 },
          { name: 'Seasonal utilities', opex: 1, capex: 0, vat: 0.2 },
          { name: 'Utilities', opex: 2, capex: 0, vat: 0.4 },
          { name: 'Budget management system', opex: 0, capex: 150, vat: 30 }
        ]
      },
      {
        category: 'Commercial',
        opex: 232.5,
        capex: 100,
        vat: 66.5,
        total: 399,
        items: [
          { name: 'Office supplies/coffee', opex: 2, capex: 0, vat: 0.4 },
          { name: 'Mobile communication', opex: 3, capex: 0, vat: 0.6 },
          { name: 'Stationery', opex: 1, capex: 0, vat: 0.2 },
          { name: 'Transportation/mail/SDEK', opex: 1, capex: 0, vat: 0.2 },
          { name: 'Fuel', opex: 13, capex: 0, vat: 2.6 },
          { name: 'Equipment maintenance', opex: 2, capex: 0, vat: 0.4 },
          { name: 'Internet', opex: 0.5, capex: 0, vat: 0.1 },
          { name: 'Setup/equipment', opex: 0, capex: 100, vat: 20 },
          { name: 'Avito', opex: 150, capex: 0, vat: 30 },
          { name: 'Ferio', opex: 20, capex: 0, vat: 4 },
          { name: 'Website', opex: 30, capex: 0, vat: 6 },
          { name: 'Drom', opex: 9, capex: 0, vat: 1.8 }
        ]
      },
      {
        category: 'Service',
        opex: 69.5,
        capex: 100,
        vat: 33.9,
        total: 203.4,
        items: [
          { name: 'Office supplies/coffee', opex: 2, capex: 0, vat: 0.4 },
          { name: 'Mobile communication', opex: 3, capex: 0, vat: 0.6 },
          { name: 'Stationery', opex: 1, capex: 0, vat: 0.2 },
          { name: 'Transportation', opex: 1, capex: 0, vat: 0.2 },
          { name: 'Fuel', opex: 13, capex: 0, vat: 2.6 },
          { name: 'Vehicle repair', opex: 30, capex: 0, vat: 6 },
          { name: 'Equipment maintenance', opex: 2, capex: 0, vat: 0.4 },
          { name: 'Internet', opex: 0.5, capex: 0, vat: 0.1 },
          { name: 'Utilities', opex: 2, capex: 0, vat: 0.4 },
          { name: 'Tools/Equipment', opex: 0, capex: 100, vat: 20 },
          { name: 'Consumables', opex: 15, capex: 0, vat: 3 }
        ]
      }
    ],

    // Organization structure data
    orgData: [
      { position: 'General Director', department: 'Office', constSalary: 190, variable: 210, bonus: 20, total: 420, isOutsourced: false },
      { position: 'Financial Director', department: 'Office', constSalary: 150, variable: 210, bonus: 20, total: 380, isOutsourced: false },
      { position: 'Accountant', department: 'Office', constSalary: 50, variable: 20, bonus: 0, total: 70, isOutsourced: true },
      { position: 'Facility Manager', department: 'Office', constSalary: 30, variable: 20, bonus: 5, total: 55, isOutsourced: false },
      { position: 'Cleaner', department: 'Office', constSalary: 10, variable: 0, bonus: 0, total: 10, isOutsourced: true },
      { position: 'System Administrator', department: 'Office', constSalary: 20, variable: 0, bonus: 0, total: 20, isOutsourced: true },
      { position: 'Commercial Director', department: 'Commercial', constSalary: 150, variable: 150, bonus: 14, total: 314, isOutsourced: false },
      { position: 'Sales Manager', department: 'Commercial', constSalary: 20, variable: 40, bonus: 5, total: 65, isOutsourced: false },
      { position: 'Sales Manager', department: 'Commercial', constSalary: 20, variable: 40, bonus: 5, total: 65, isOutsourced: false },
      { position: 'Marketer', department: 'Commercial', constSalary: 20, variable: 90, bonus: 6, total: 116, isOutsourced: false },
      { position: 'Service Manager', department: 'Commercial', constSalary: 60, variable: 7, bonus: 6, total: 73, isOutsourced: false },
      { position: 'IT Specialist', department: 'Commercial', constSalary: 100, variable: 90, bonus: 12, total: 202, isOutsourced: false },
      { position: 'Logistics Specialist', department: 'Commercial', constSalary: 20, variable: 50, bonus: 4, total: 74, isOutsourced: false },
      { position: 'Chief Engineer', department: 'Service', constSalary: 25, variable: 50, bonus: 10, total: 85, isOutsourced: false },
      { position: 'Service Administrator', department: 'Service', constSalary: 60, variable: 6, bonus: 6, total: 72, isOutsourced: false },
      { position: 'Procurement Manager', department: 'Service', constSalary: 20, variable: 45, bonus: 4, total: 69, isOutsourced: false },
      { position: 'Warehouse Keeper', department: 'Service', constSalary: 50, variable: 10, bonus: 4, total: 64, isOutsourced: false },
      { position: 'Driver', department: 'Service', constSalary: 25, variable: 5, bonus: 3, total: 33, isOutsourced: false },
      { position: 'Worker', department: 'Service', constSalary: 35, variable: 5, bonus: 4, total: 44, isOutsourced: false },
      { position: 'Worker', department: 'Service', constSalary: 35, variable: 5, bonus: 4, total: 44, isOutsourced: false },
      { position: 'Chief Mechanic', department: 'Service', constSalary: 80, variable: 15, bonus: 6, total: 101, isOutsourced: false },
      { position: 'Auto Electrician', department: 'Service', constSalary: 50, variable: 6, bonus: 4, total: 60, isOutsourced: false },
      { position: 'Motor Mechanic', department: 'Service', constSalary: 50, variable: 6, bonus: 4, total: 60, isOutsourced: false },
      { position: 'Suspension Mechanic', department: 'Service', constSalary: 50, variable: 6, bonus: 4, total: 60, isOutsourced: false },
      { position: 'Tire Fitter', department: 'Service', constSalary: 25, variable: 6, bonus: 3, total: 34, isOutsourced: false },
      { position: 'Painter', department: 'Service', constSalary: 25, variable: 6, bonus: 3, total: 34, isOutsourced: false },
      { position: 'Mechanic', department: 'Service', constSalary: 50, variable: 10, bonus: 4, total: 64, isOutsourced: false }
    ],

    // Recent fact data entries
    recentEntries: [],

    // Loading states
    loading: false,
    error: null
  }),

  getters: {
    /**
     * Calculate plan/fact variance percentage
     */
    planFactVariance: (state) => {
      const totalPlan = state.monthlyData.reduce((sum, m) => sum + m.revenuePlan, 0)
      const totalFact = state.monthlyData.reduce((sum, m) => sum + m.revenueFact, 0)
      if (totalPlan === 0) return 0
      return ((totalFact - totalPlan) / totalPlan) * 100
    },

    /**
     * Calculate payroll summary
     */
    payrollSummary: (state) => {
      return {
        totalConst: state.payrollData.reduce((sum, d) => sum + d.constTotal, 0),
        totalVariable: state.payrollData.reduce((sum, d) => sum + d.variableTotal, 0),
        totalBonus: state.payrollData.reduce((sum, d) => sum + d.bonusTotal, 0),
        totalTax: state.payrollData.reduce((sum, d) => sum + d.constTax, 0),
        grandTotal: state.payrollData.reduce((sum, d) => sum + d.total, 0)
      }
    },

    /**
     * Calculate cost summary
     */
    costSummary: (state) => {
      return {
        managementCosts: state.costsData
          .filter(c => c.category === 'Office')
          .reduce((sum, c) => sum + c.total, 0),
        maintenanceCosts: state.costsData
          .filter(c => c.category !== 'Office')
          .reduce((sum, c) => sum + c.total, 0),
        totalCosts: state.costsData.reduce((sum, c) => sum + c.total, 0),
        totalOpex: state.costsData.reduce((sum, c) => sum + c.opex, 0),
        totalCapex: state.costsData.reduce((sum, c) => sum + c.capex, 0),
        totalVat: state.costsData.reduce((sum, c) => sum + c.vat, 0)
      }
    },

    /**
     * Calculate organization summary
     */
    orgSummary: (state) => {
      return {
        totalEmployees: state.orgData.length,
        outsourcedCount: state.orgData.filter(e => e.isOutsourced).length,
        staffCount: state.orgData.filter(e => !e.isOutsourced).length,
        plannedRevenue: state.summary.plannedRevenue,
        depositedBonus: state.summary.depositedBonus
      }
    },

    /**
     * Get total monthly revenue plan
     */
    totalRevenuePlan: (state) => {
      return state.monthlyData.reduce((sum, m) => sum + m.revenuePlan, 0)
    },

    /**
     * Get total monthly revenue fact
     */
    totalRevenueFact: (state) => {
      return state.monthlyData.reduce((sum, m) => sum + m.revenueFact, 0)
    }
  },

  actions: {
    /**
     * Load budget data for a specific period
     */
    async loadBudgetData(period) {
      this.loading = true
      this.error = null

      try {
        // In a real implementation, this would fetch from an API
        // For now, we use the demo data defined in state
        console.log('Loading budget data for period:', period)

        // Simulate API delay
        await new Promise(resolve => setTimeout(resolve, 500))

        return {
          success: true,
          data: {
            summary: this.summary,
            monthlyData: this.monthlyData,
            payrollData: this.payrollData,
            costsData: this.costsData,
            orgData: this.orgData
          }
        }
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Add a new employee
     */
    async addEmployee(employeeData) {
      this.loading = true
      this.error = null

      try {
        // Find the department
        const deptIndex = this.payrollData.findIndex(
          d => d.department.toLowerCase().includes(employeeData.department)
        )

        const newEmployee = {
          position: employeeData.position,
          constSalary: employeeData.constSalary,
          tax: employeeData.constSalary > 17 ? 6.8 : 0, // Tax on min salary 17k
          variable: employeeData.variable,
          bonus: employeeData.bonus,
          total: employeeData.constSalary + employeeData.variable + employeeData.bonus,
          premiumDescription: employeeData.premiumDescription,
          isOutsourced: employeeData.isOutsourced
        }

        if (deptIndex !== -1) {
          this.payrollData[deptIndex].employees.push(newEmployee)
          // Recalculate department totals
          this.recalculateDepartmentTotals(deptIndex)
        }

        // Add to org data
        this.orgData.push({
          position: employeeData.position,
          department: employeeData.department,
          constSalary: employeeData.constSalary,
          variable: employeeData.variable,
          bonus: employeeData.bonus,
          total: newEmployee.total,
          isOutsourced: employeeData.isOutsourced
        })

        return { success: true, employee: newEmployee }
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Recalculate department totals after employee changes
     */
    recalculateDepartmentTotals(deptIndex) {
      const dept = this.payrollData[deptIndex]
      dept.constTotal = dept.employees.reduce((sum, e) => sum + e.constSalary, 0)
      dept.constTax = dept.employees.reduce((sum, e) => sum + e.tax, 0)
      dept.variableTotal = dept.employees.reduce((sum, e) => sum + e.variable, 0)
      dept.bonusTotal = dept.employees.reduce((sum, e) => sum + e.bonus, 0)
      dept.total = dept.employees.reduce((sum, e) => sum + e.total, 0)
    },

    /**
     * Add a new cost item
     */
    async addCostItem(costData) {
      this.loading = true
      this.error = null

      try {
        // Find the category
        const catIndex = this.costsData.findIndex(
          c => c.category.toLowerCase() === costData.category.toLowerCase()
        )

        const newItem = {
          name: costData.name,
          opex: costData.opex,
          capex: costData.capex,
          vat: costData.vat
        }

        if (catIndex !== -1) {
          this.costsData[catIndex].items.push(newItem)
          // Recalculate category totals
          this.recalculateCategoryTotals(catIndex)
        } else {
          // Create new category
          this.costsData.push({
            category: costData.category,
            opex: costData.opex,
            capex: costData.capex,
            vat: costData.vat,
            total: costData.opex + costData.capex + costData.vat,
            items: [newItem]
          })
        }

        return { success: true, item: newItem }
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Recalculate category totals after cost changes
     */
    recalculateCategoryTotals(catIndex) {
      const cat = this.costsData[catIndex]
      cat.opex = cat.items.reduce((sum, i) => sum + i.opex, 0)
      cat.capex = cat.items.reduce((sum, i) => sum + i.capex, 0)
      cat.vat = cat.items.reduce((sum, i) => sum + i.vat, 0)
      cat.total = cat.opex + cat.capex + cat.vat
    },

    /**
     * Save fact data entry for a month
     */
    async saveFactEntry(entryData) {
      this.loading = true
      this.error = null

      try {
        // Find the month and update fact data
        const monthIndex = this.monthlyData.findIndex(m => {
          const monthNames = ['', '', '', '', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
          return m.month === monthNames[entryData.month]
        })

        if (monthIndex !== -1) {
          this.monthlyData[monthIndex].revenueFact = entryData.revenue
          this.monthlyData[monthIndex].ebitdaFact = entryData.ebitda
          this.monthlyData[monthIndex].cfFact = entryData.cashFlow

          // Calculate variance
          const plan = this.monthlyData[monthIndex].revenuePlan
          const fact = entryData.revenue
          this.monthlyData[monthIndex].variance = plan > 0 ? ((fact - plan) / plan) * 100 : 0
        }

        // Add to recent entries
        this.recentEntries.unshift({
          id: Date.now(),
          date: new Date().toISOString(),
          month: ['', '', '', '', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][entryData.month],
          revenue: entryData.revenue,
          ebitda: entryData.ebitda,
          cashFlow: entryData.cashFlow,
          enteredBy: 'Current User' // TODO: Get from auth store
        })

        // Keep only last 50 entries
        if (this.recentEntries.length > 50) {
          this.recentEntries = this.recentEntries.slice(0, 50)
        }

        return { success: true }
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Export report as Excel/PDF
     */
    async exportReport(period) {
      this.loading = true
      this.error = null

      try {
        // In a real implementation, this would generate and download a file
        console.log('Exporting report for period:', period)

        // Simulate export delay
        await new Promise(resolve => setTimeout(resolve, 1000))

        return { success: true, message: 'Report exported successfully' }
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Import data from Excel file
     */
    async importFromExcel(file) {
      this.loading = true
      this.error = null

      try {
        // In a real implementation, this would parse the Excel file
        console.log('Importing from file:', file.name)

        // Simulate import delay
        await new Promise(resolve => setTimeout(resolve, 2000))

        return { success: true, message: 'Data imported successfully' }
      } catch (error) {
        this.error = error.message
        throw error
      } finally {
        this.loading = false
      }
    },

    /**
     * Clear all data
     */
    clearData() {
      this.recentEntries = []
      this.loading = false
      this.error = null
    }
  }
})
