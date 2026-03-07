#!/usr/bin/env python3
"""
FST API Python SDK Example

Пример использования REST API Фонда Суверенных Технологий (ФСТ)

Установка зависимостей:
    pip install requests

Использование:
    export FST_API_TOKEN="your_api_token_here"
    python python_example.py
"""

import os
import requests
from typing import Dict, List, Optional
from datetime import datetime


class FSTClient:
    """Клиент для работы с FST REST API"""

    def __init__(self, api_token: str, base_url: str = "https://dev.drondoc.ru"):
        """
        Инициализация клиента

        Args:
            api_token: API токен для аутентификации (получить: unidel@yandex.ru)
            base_url: Базовый URL API (по умолчанию production)
        """
        self.api_token = api_token
        self.base_url = base_url.rstrip('/')
        self.session = requests.Session()
        self.session.headers.update({
            'Authorization': f'Bearer {api_token}',
            'Content-Type': 'application/json',
            'User-Agent': 'FST-Python-SDK/1.0.0'
        })

    def get_portfolio(self) -> Dict:
        """
        Получить список портфельных компаний

        Returns:
            Dict с полями: total, companies, timestamp
        """
        response = self.session.get(f'{self.base_url}/api/fst/portfolio')
        response.raise_for_status()
        return response.json()

    def get_company(self, company_id: int) -> Dict:
        """
        Получить детали портфельной компании

        Args:
            company_id: ID компании

        Returns:
            Dict с детальной информацией о компании
        """
        response = self.session.get(f'{self.base_url}/api/fst/company/{company_id}')
        response.raise_for_status()
        return response.json()

    def get_kpis(self) -> Dict:
        """
        Получить агрегированные KPI портфеля

        Returns:
            Dict с KPI всего портфеля
        """
        response = self.session.get(f'{self.base_url}/api/fst/kpis')
        response.raise_for_status()
        return response.json()

    def submit_application(
        self,
        company_name: str,
        inn: str,
        description: str,
        requested_amount: int,
        ogrn: Optional[str] = None,
        trl: Optional[int] = None,
        sovereignty: Optional[int] = None,
        contact_email: Optional[str] = None,
        contact_phone: Optional[str] = None,
        source: str = "api"
    ) -> Dict:
        """
        Подать заявку на финансирование

        Args:
            company_name: Название компании
            inn: ИНН компании
            description: Описание проекта
            requested_amount: Запрашиваемая сумма (руб.)
            ogrn: ОГРН (опционально)
            trl: Technology Readiness Level 1-9 (опционально)
            sovereignty: Индекс суверенности 0-10 (опционально)
            contact_email: Email для связи (опционально)
            contact_phone: Телефон (опционально)
            source: Источник заявки (по умолчанию 'api')

        Returns:
            Dict с applicationId и статусом
        """
        data = {
            'companyName': company_name,
            'inn': inn,
            'description': description,
            'requestedAmount': requested_amount,
            'source': source
        }

        # Добавляем опциональные поля
        if ogrn:
            data['ogrn'] = ogrn
        if trl:
            data['trl'] = trl
        if sovereignty:
            data['sovereignty'] = sovereignty
        if contact_email:
            data['contactEmail'] = contact_email
        if contact_phone:
            data['contactPhone'] = contact_phone

        response = self.session.post(
            f'{self.base_url}/api/fst/apply',
            json=data
        )
        response.raise_for_status()
        return response.json()

    def get_application_status(self, application_id: int) -> Dict:
        """
        Проверить статус заявки

        Args:
            application_id: ID заявки

        Returns:
            Dict со статусом заявки и результатами рассмотрения
        """
        response = self.session.get(
            f'{self.base_url}/api/fst/application/{application_id}'
        )
        response.raise_for_status()
        return response.json()

    def health_check(self) -> Dict:
        """
        Проверка работоспособности API

        Returns:
            Dict со статусом сервиса
        """
        response = requests.get(f'{self.base_url}/api/fst/health')
        response.raise_for_status()
        return response.json()


# Примеры использования
if __name__ == '__main__':
    # Получаем API токен из переменных окружения
    API_TOKEN = os.getenv('FST_API_TOKEN')
    if not API_TOKEN:
        print("Error: FST_API_TOKEN environment variable not set")
        print("Usage: export FST_API_TOKEN='your_token' && python python_example.py")
        exit(1)

    # Инициализируем клиент
    client = FSTClient(api_token=API_TOKEN)

    print("=" * 60)
    print("FST API Python SDK - Примеры использования")
    print("=" * 60)

    # 1. Health check (не требует токена)
    print("\n1. Health Check:")
    health = client.health_check()
    print(f"   Status: {health['status']}")
    print(f"   Service: {health['service']} v{health['version']}")

    # 2. Получить список портфеля
    print("\n2. Portfolio Companies:")
    try:
        portfolio = client.get_portfolio()
        print(f"   Total companies: {portfolio['total']}")
        for company in portfolio['companies'][:3]:  # Показываем первые 3
            print(f"   - {company['name']} (INN: {company['inn']})")
            print(f"     Health: {company['healthScore']} ({company['trafficLight']})")
    except requests.exceptions.HTTPError as e:
        print(f"   Error: {e}")

    # 3. Получить KPI портфеля
    print("\n3. Portfolio KPIs:")
    try:
        kpis = client.get_kpis()
        print(f"   Total companies: {kpis['totalCompanies']}")
        print(f"   Average health score: {kpis['averageHealthScore']}")
        print(f"   Traffic lights: 🟢 {kpis['trafficLightDistribution']['green']} "
              f"🟡 {kpis['trafficLightDistribution']['yellow']} "
              f"🔴 {kpis['trafficLightDistribution']['red']}")
        print(f"   Total patents: {kpis['totalPatents']}")
    except requests.exceptions.HTTPError as e:
        print(f"   Error: {e}")

    # 4. Подать заявку (закомментировано, чтобы не создавать реальные заявки)
    print("\n4. Submit Application (example - commented out):")
    print("""
    application = client.submit_application(
        company_name="ИнноТех",
        inn="7729123456",
        ogrn="1177746123456",
        description="Разработка инновационных БПЛА для гражданского применения",
        requested_amount=50_000_000,
        trl=6,
        sovereignty=8,
        contact_email="contact@innotech.ru",
        source="api"
    )
    print(f"   Application ID: {application['applicationId']}")
    print(f"   Status: {application['status']}")
    """)

    # 5. Проверить статус заявки (пример)
    print("\n5. Check Application Status (example - commented out):")
    print("""
    status = client.get_application_status(application_id=1202)
    print(f"   Company: {status['companyName']}")
    print(f"   Status: {status['status']}")
    if 'committeeReview' in status:
        print(f"   Committee decision: {status['committeeReview']['decision']}")
        print(f"   Score: {status['committeeReview']['score']}")
    """)

    print("\n" + "=" * 60)
    print("Документация: https://dev.drondoc.ru/api/fst/docs")
    print("=" * 60)
