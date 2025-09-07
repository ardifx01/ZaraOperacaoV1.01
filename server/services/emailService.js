const nodemailer = require('nodemailer');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  async initializeTransporter() {
    try {
      // Configuração do transporter (Gmail como exemplo)
      this.transporter = nodemailer.createTransporter({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASSWORD
        }
      });

      // Verificar conexão
      await this.transporter.verify();
      console.log('📧 Serviço de email configurado com sucesso');
    } catch (error) {
      console.error('❌ Erro ao configurar serviço de email:', error.message);
    }
  }

  async sendQualityTestAlert(testData, recipients) {
    try {
      const subject = `🚨 Alerta de Qualidade - ${testData.result === 'APPROVED' ? 'Aprovado' : 'Reprovado'}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1>Sistema ZARA - Alerta de Qualidade</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: ${testData.result === 'APPROVED' ? '#28a745' : '#dc3545'};">Teste ${testData.result === 'APPROVED' ? 'Aprovado' : 'Reprovado'}</h2>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <p><strong>Máquina:</strong> ${testData.machine?.name || 'N/A'}</p>
              <p><strong>Operador:</strong> ${testData.user?.name || 'N/A'}</p>
              <p><strong>Data/Hora:</strong> ${new Date(testData.createdAt).toLocaleString('pt-BR')}</p>
              <p><strong>Resultado:</strong> <span style="color: ${testData.result === 'APPROVED' ? '#28a745' : '#dc3545'}; font-weight: bold;">${testData.result === 'APPROVED' ? 'APROVADO' : 'REPROVADO'}</span></p>
              ${testData.observations ? `<p><strong>Observações:</strong> ${testData.observations}</p>` : ''}
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Dashboard</a>
            </div>
          </div>
          
          <div style="background: #343a40; color: white; padding: 10px; text-align: center; font-size: 12px;">
            <p>Sistema ZARA - Controle de Qualidade Industrial</p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipients.join(', '),
        subject,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email de alerta de qualidade enviado:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Erro ao enviar email de alerta:', error);
      return { success: false, error: error.message };
    }
  }

  async sendTeflonChangeReminder(changeData, recipients) {
    try {
      const daysUntilExpiry = Math.ceil((new Date(changeData.expiryDate) - new Date()) / (1000 * 60 * 60 * 24));
      const isExpired = daysUntilExpiry <= 0;
      
      const subject = isExpired 
        ? `🚨 URGENTE: Teflon Vencido - ${changeData.machine?.name}`
        : `⚠️ Lembrete: Troca de Teflon em ${daysUntilExpiry} dias - ${changeData.machine?.name}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: ${isExpired ? '#dc3545' : '#ffc107'}; color: ${isExpired ? 'white' : '#212529'}; padding: 20px; text-align: center;">
            <h1>Sistema ZARA - ${isExpired ? 'Teflon Vencido' : 'Lembrete de Troca'}</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: ${isExpired ? '#dc3545' : '#ffc107'};">Atenção Necessária</h2>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <p><strong>Máquina:</strong> ${changeData.machine?.name || 'N/A'}</p>
              <p><strong>Data da Última Troca:</strong> ${new Date(changeData.changeDate).toLocaleDateString('pt-BR')}</p>
              <p><strong>Data de Vencimento:</strong> ${new Date(changeData.expiryDate).toLocaleDateString('pt-BR')}</p>
              <p><strong>Status:</strong> 
                <span style="color: ${isExpired ? '#dc3545' : '#ffc107'}; font-weight: bold;">
                  ${isExpired ? 'VENCIDO' : `${daysUntilExpiry} dias restantes`}
                </span>
              </p>
              ${changeData.observations ? `<p><strong>Observações:</strong> ${changeData.observations}</p>` : ''}
            </div>
            
            <div style="background: ${isExpired ? '#f8d7da' : '#fff3cd'}; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <p style="margin: 0; font-weight: bold;">
                ${isExpired 
                  ? '⚠️ AÇÃO IMEDIATA NECESSÁRIA: O teflon desta máquina está vencido e deve ser trocado imediatamente.'
                  : `📅 PROGRAMAR TROCA: O teflon desta máquina vence em ${daysUntilExpiry} dias. Programe a troca.`
                }
              </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/teflon" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Gerenciar Teflon</a>
            </div>
          </div>
          
          <div style="background: #343a40; color: white; padding: 10px; text-align: center; font-size: 12px;">
            <p>Sistema ZARA - Controle de Qualidade Industrial</p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipients.join(', '),
        subject,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email de lembrete de teflon enviado:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Erro ao enviar email de lembrete:', error);
      return { success: false, error: error.message };
    }
  }

  async sendMachineStatusAlert(machineData, recipients) {
    try {
      const subject = `🔧 Alerta de Máquina - ${machineData.name} (${machineData.status})`;
      
      const statusColors = {
        'ACTIVE': '#28a745',
        'INACTIVE': '#6c757d',
        'MAINTENANCE': '#ffc107',
        'ERROR': '#dc3545'
      };
      
      const statusLabels = {
        'ACTIVE': 'Ativa',
        'INACTIVE': 'Inativa',
        'MAINTENANCE': 'Manutenção',
        'ERROR': 'Erro'
      };
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1>Sistema ZARA - Alerta de Máquina</h1>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: ${statusColors[machineData.status]};">Status da Máquina Alterado</h2>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <p><strong>Máquina:</strong> ${machineData.name}</p>
              <p><strong>Localização:</strong> ${machineData.location || 'N/A'}</p>
              <p><strong>Status Atual:</strong> 
                <span style="color: ${statusColors[machineData.status]}; font-weight: bold;">
                  ${statusLabels[machineData.status]}
                </span>
              </p>
              <p><strong>Data/Hora:</strong> ${new Date().toLocaleString('pt-BR')}</p>
              ${machineData.description ? `<p><strong>Descrição:</strong> ${machineData.description}</p>` : ''}
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/machines" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Máquinas</a>
            </div>
          </div>
          
          <div style="background: #343a40; color: white; padding: 10px; text-align: center; font-size: 12px;">
            <p>Sistema ZARA - Controle de Qualidade Industrial</p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipients.join(', '),
        subject,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email de alerta de máquina enviado:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Erro ao enviar email de alerta de máquina:', error);
      return { success: false, error: error.message };
    }
  }

  async sendDailyReport(reportData, recipients) {
    try {
      const subject = `📊 Relatório Diário - ${new Date().toLocaleDateString('pt-BR')}`;
      
      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center;">
            <h1>Sistema ZARA - Relatório Diário</h1>
            <p>${new Date().toLocaleDateString('pt-BR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          
          <div style="padding: 20px; background: #f8f9fa;">
            <h2 style="color: #343a40;">Resumo do Dia</h2>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
              <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
                <h3 style="color: #28a745; margin: 0;">Testes Aprovados</h3>
                <p style="font-size: 24px; font-weight: bold; margin: 5px 0;">${reportData.approvedTests || 0}</p>
              </div>
              
              <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
                <h3 style="color: #dc3545; margin: 0;">Testes Reprovados</h3>
                <p style="font-size: 24px; font-weight: bold; margin: 5px 0;">${reportData.rejectedTests || 0}</p>
              </div>
              
              <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
                <h3 style="color: #007bff; margin: 0;">Máquinas Ativas</h3>
                <p style="font-size: 24px; font-weight: bold; margin: 5px 0;">${reportData.activeMachines || 0}</p>
              </div>
              
              <div style="background: white; padding: 15px; border-radius: 8px; text-align: center;">
                <h3 style="color: #ffc107; margin: 0;">Trocas de Teflon</h3>
                <p style="font-size: 24px; font-weight: bold; margin: 5px 0;">${reportData.teflonChanges || 0}</p>
              </div>
            </div>
            
            <div style="background: white; padding: 15px; border-radius: 8px; margin: 10px 0;">
              <h3 style="color: #343a40;">Taxa de Qualidade</h3>
              <div style="background: #e9ecef; height: 20px; border-radius: 10px; overflow: hidden;">
                <div style="background: #28a745; height: 100%; width: ${reportData.qualityRate || 0}%; transition: width 0.3s;"></div>
              </div>
              <p style="text-align: center; margin: 5px 0; font-weight: bold;">${reportData.qualityRate || 0}%</p>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
              <a href="${process.env.FRONTEND_URL}/dashboard" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Ver Dashboard Completo</a>
            </div>
          </div>
          
          <div style="background: #343a40; color: white; padding: 10px; text-align: center; font-size: 12px;">
            <p>Sistema ZARA - Controle de Qualidade Industrial</p>
          </div>
        </div>
      `;

      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: recipients.join(', '),
        subject,
        html: htmlContent
      };

      const result = await this.transporter.sendMail(mailOptions);
      console.log('📧 Relatório diário enviado:', result.messageId);
      return { success: true, messageId: result.messageId };
    } catch (error) {
      console.error('❌ Erro ao enviar relatório diário:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new EmailService();