"""align_columns_with_erd_v2

Revision ID: 86d930f2035a
Revises: 0fc2023e9711
Create Date: 2026-10-16 13:20:58.825135

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '86d930f2035a'
down_revision: Union[str, Sequence[str], None] = '0fc2023e9711'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema to align column names with ERD v2 and Data Dictionary v2."""
    op.alter_column('service_requests', 'lat', new_column_name='latitude')
    op.alter_column('service_requests', 'lon', new_column_name='longitude')

    op.alter_column('customers', 'lat', new_column_name='latitude')
    op.alter_column('customers', 'lon', new_column_name='longitude')

    op.alter_column('employees', 'base_lat', new_column_name='base_latitude')
    op.alter_column('employees', 'base_lon', new_column_name='base_longitude')

    op.alter_column('services', 'active', new_column_name='is_active')
    op.alter_column('service_required_skills', 'mandatory', new_column_name='is_mandatory')
    op.alter_column('ai_model_versions', 'active', new_column_name='is_active')


def downgrade() -> None:
    """Downgrade schema."""
    op.alter_column('ai_model_versions', 'is_active', new_column_name='active')
    op.alter_column('service_required_skills', 'is_mandatory', new_column_name='mandatory')
    op.alter_column('services', 'is_active', new_column_name='active')

    op.alter_column('employees', 'base_longitude', new_column_name='base_lon')
    op.alter_column('employees', 'base_latitude', new_column_name='base_lat')

    op.alter_column('customers', 'longitude', new_column_name='lon')
    op.alter_column('customers', 'latitude', new_column_name='lat')

    op.alter_column('service_requests', 'longitude', new_column_name='lon')
    op.alter_column('service_requests', 'latitude', new_column_name='lat')
